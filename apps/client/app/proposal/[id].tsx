import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Alert, Platform, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useMemo, useEffect, useCallback } from 'react';

import { useAuthStore } from '../../src/store/authStore';
import { generateDemoProposals, Proposal, DEMO_WEATHER } from '../../src/data/demoData';

interface LocationSuggestion {
  placeId: string;
  name: string;
  address: string;
  latitude?: number;
  longitude?: number;
  openingHours?: {
    isOpen: boolean;
    weekdayText?: string[];
  };
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const getAccessToken = (): string | null => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('accessToken');
  }
  return null;
};

interface CalendarEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  type: string;
  isLocked?: boolean;
}

interface ParsedInput {
  cleanTitle: string;
  preferredDate?: Date;
  preferredTimeStart?: number; // hour (0-23)
  preferredTimeEnd?: number;
  location?: string;
}

// Parse natural language input for date, time, and location
const parseNaturalLanguage = (input: string): ParsedInput => {
  const now = new Date();
  let cleanTitle = input;
  let preferredDate: Date | undefined;
  let preferredTimeStart: number | undefined;
  let preferredTimeEnd: number | undefined;
  let location: string | undefined;

  const lowerInput = input.toLowerCase();

  // Parse day of week
  const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  for (let i = 0; i < days.length; i++) {
    if (lowerInput.includes(days[i])) {
      const today = now.getDay();
      let daysUntil = i - today;
      if (daysUntil <= 0) daysUntil += 7; // Next occurrence
      preferredDate = new Date(now);
      preferredDate.setDate(preferredDate.getDate() + daysUntil);
      cleanTitle = cleanTitle.replace(new RegExp(`\\s*(on\\s+)?${days[i]}`, 'gi'), '');
    }
  }

  // Parse "today" / "tomorrow"
  if (lowerInput.includes('today')) {
    preferredDate = new Date(now);
    cleanTitle = cleanTitle.replace(/\s*(for\s+)?today/gi, '');
  } else if (lowerInput.includes('tomorrow')) {
    preferredDate = new Date(now);
    preferredDate.setDate(preferredDate.getDate() + 1);
    cleanTitle = cleanTitle.replace(/\s*(for\s+)?tomorrow/gi, '');
  }

  // Parse time patterns like "at 3pm", "at 3:00", "at 15:00"
  const timePattern = /\s*at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/gi;
  const timeMatch = timePattern.exec(lowerInput);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1]);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
    const ampm = timeMatch[3]?.toLowerCase();

    if (ampm === 'pm' && hour < 12) hour += 12;
    if (ampm === 'am' && hour === 12) hour = 0;

    preferredTimeStart = hour;
    preferredTimeEnd = hour + 2; // Default 2 hour window
    cleanTitle = cleanTitle.replace(/\s*at\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?/gi, '');
  }

  // Parse time of day
  if (lowerInput.includes('morning')) {
    preferredTimeStart = 8;
    preferredTimeEnd = 12;
    cleanTitle = cleanTitle.replace(/\s*(in the\s+)?morning/gi, '');
  } else if (lowerInput.includes('afternoon')) {
    preferredTimeStart = 12;
    preferredTimeEnd = 17;
    cleanTitle = cleanTitle.replace(/\s*(in the\s+)?afternoon/gi, '');
  } else if (lowerInput.includes('evening')) {
    preferredTimeStart = 17;
    preferredTimeEnd = 20;
    cleanTitle = cleanTitle.replace(/\s*(in the\s+)?evening/gi, '');
  }

  // Parse location patterns like "at [place]" (after time is extracted)
  // Look for "at" followed by words that aren't times
  const locationPattern = /\s+at\s+([A-Za-z][A-Za-z0-9\s']+?)(?:\s+(?:on|today|tomorrow|at\s+\d)|$)/i;
  const locationMatch = locationPattern.exec(cleanTitle);
  if (locationMatch) {
    location = locationMatch[1].trim();
    cleanTitle = cleanTitle.replace(locationPattern, ' ');
  }

  // Also check for common location prepositions
  const locationPattern2 = /\s+(?:in|near|@)\s+([A-Za-z][A-Za-z0-9\s']+?)(?:\s+(?:on|today|tomorrow)|$)/i;
  const locationMatch2 = locationPattern2.exec(cleanTitle);
  if (locationMatch2 && !location) {
    location = locationMatch2[1].trim();
    cleanTitle = cleanTitle.replace(locationPattern2, ' ');
  }

  // Clean up the title
  cleanTitle = cleanTitle.replace(/\s+/g, ' ').trim();

  return {
    cleanTitle,
    preferredDate,
    preferredTimeStart,
    preferredTimeEnd,
    location,
  };
};

// Calculate available slots based on existing events
const calculateAvailableSlots = (
  events: CalendarEvent[],
  durationMinutes: number = 60,
  daysToCheck: number = 7,
  isUrgent: boolean = false,
  preferences?: ParsedInput
): Proposal[] => {
  const now = new Date();
  const proposals: Proposal[] = [];

  // Work hours: 8 AM to 8 PM (can be overridden by preferences)
  let workStartHour = preferences?.preferredTimeStart ?? 8;
  let workEndHour = preferences?.preferredTimeEnd ?? 20;

  // If specific time preference, narrow the window
  if (preferences?.preferredTimeStart !== undefined) {
    workStartHour = Math.max(8, preferences.preferredTimeStart);
    workEndHour = Math.min(20, preferences.preferredTimeEnd ?? preferences.preferredTimeStart + 2);
  }

  // For urgent mode, only check next 3 hours
  const urgentEndTime = new Date(now.getTime() + 3 * 60 * 60 * 1000);

  // Sort events by start time
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
  );

  // Determine which day to check based on preferences
  let startDayOffset = 0;
  let endDayOffset = daysToCheck;

  if (preferences?.preferredDate) {
    // Calculate offset to preferred date
    const prefDate = new Date(preferences.preferredDate);
    prefDate.setHours(0, 0, 0, 0);
    const todayMidnight = new Date(now);
    todayMidnight.setHours(0, 0, 0, 0);
    const dayDiff = Math.round((prefDate.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));

    if (dayDiff >= 0 && dayDiff < 14) {
      startDayOffset = dayDiff;
      endDayOffset = dayDiff + 1; // Only check the preferred day first
    }
  }

  // Check preferred day first, then other days
  const maxDays = isUrgent ? 1 : daysToCheck;
  const daysToProcess = preferences?.preferredDate
    ? [startDayOffset, ...Array.from({ length: maxDays }, (_, i) => i).filter(d => d !== startDayOffset)]
    : Array.from({ length: maxDays }, (_, i) => i);

  for (const dayOffset of daysToProcess) {
    if (proposals.length >= 6) break;
    if (dayOffset >= maxDays) continue;

    const checkDate = new Date(now);
    checkDate.setDate(checkDate.getDate() + dayOffset);
    checkDate.setHours(workStartHour, 0, 0, 0);

    // For today, start from current time (rounded up to next 30 min)
    if (dayOffset === 0) {
      const currentMinutes = now.getMinutes();
      const roundedMinutes = currentMinutes < 30 ? 30 : 0;
      const addHours = currentMinutes >= 30 ? 1 : 0;
      const proposedHour = now.getHours() + addHours;
      checkDate.setHours(Math.max(proposedHour, workStartHour), roundedMinutes, 0, 0);

      // If past work hours, skip to next day
      if (checkDate.getHours() >= workEndHour) continue;
    }

    // Get events for this day
    const dayStart = new Date(checkDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const dayEvents = sortedEvents.filter(e => {
      const start = new Date(e.startAt);
      return start >= dayStart && start < dayEnd;
    });

    // Find gaps in the schedule
    let currentTime = new Date(checkDate);
    let endOfWorkDay = new Date(checkDate);
    endOfWorkDay.setHours(workEndHour, 0, 0, 0);

    // For urgent mode, limit to 3 hours from now
    if (isUrgent && urgentEndTime < endOfWorkDay) {
      endOfWorkDay = urgentEndTime;
    }

    // Check 30-minute intervals
    while (currentTime < endOfWorkDay && proposals.length < 6) {
      const slotEnd = new Date(currentTime.getTime() + durationMinutes * 60 * 1000);

      // Find conflicting events
      const conflictingEvents = dayEvents.filter(event => {
        const eventStart = new Date(event.startAt);
        const eventEnd = new Date(event.endAt);
        return (currentTime < eventEnd && slotEnd > eventStart);
      });

      // Check if any conflict is locked (can't be moved)
      const hasLockedConflict = conflictingEvents.some(e => e.isLocked);

      // For urgent mode, we can move non-locked events
      const canUseSlot = conflictingEvents.length === 0 || (isUrgent && !hasLockedConflict);

      if (canUseSlot && slotEnd <= endOfWorkDay) {
        // Calculate travel time (mock: 15-25 min based on time of day)
        const hour = currentTime.getHours();
        const travelMinutes = hour >= 7 && hour <= 9 ? 25 : hour >= 16 && hour <= 18 ? 22 : 15;

        const departAt = new Date(currentTime.getTime() - travelMinutes * 60 * 1000);

        // Calculate confidence based on factors
        let confidence = 0.9;
        if (dayOffset === 0) confidence += 0.05; // Prefer today
        if (hour >= 9 && hour <= 16) confidence += 0.03; // Prefer business hours
        if (travelMinutes > 20) confidence -= 0.05; // Penalize rush hour
        if (conflictingEvents.length > 0) confidence -= 0.1; // Penalize if moving events
        confidence = Math.min(0.98, Math.max(0.6, confidence));

        const explanations: string[] = [];
        if (isUrgent) explanations.push('URGENT: Next 3 hours');
        if (dayOffset === 0) explanations.push('Available today');
        else explanations.push(`${dayOffset} day${dayOffset > 1 ? 's' : ''} from now`);
        explanations.push(`${travelMinutes} min estimated travel`);

        if (conflictingEvents.length === 0) {
          explanations.push('No conflicts with existing events');
        } else {
          explanations.push(`Will reschedule ${conflictingEvents.length} event(s)`);
        }

        if (hour >= 9 && hour <= 16) explanations.push('Within preferred work hours');

        // Get names of events that would be moved
        const movedItems = conflictingEvents.map(e => e.title);

        // Determine disruption level based on moved events
        let disruption: 'none' | 'low' | 'medium' | 'high' = 'none';
        if (movedItems.length === 1) disruption = 'low';
        else if (movedItems.length === 2) disruption = 'medium';
        else if (movedItems.length > 2) disruption = 'high';

        proposals.push({
          id: `prop-${proposals.length + 1}`,
          slotStart: currentTime.toISOString(),
          slotEnd: slotEnd.toISOString(),
          departAt: departAt.toISOString(),
          travelMinutes,
          confidence,
          explanation: explanations,
          disruption,
          movedItems: movedItems.length > 0 ? movedItems : undefined,
        });
      }

      // Move to next 30-minute slot
      currentTime = new Date(currentTime.getTime() + 30 * 60 * 1000);
    }
  }

  // Sort by confidence (best first)
  proposals.sort((a, b) => b.confidence - a.confidence);

  return proposals.slice(0, 4); // Return top 4 proposals
};

export default function ProposalScreen() {
  const { id, title: taskTitle, duration } = useLocalSearchParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isDemoMode = user?.id === 'demo-user';

  const [loading, setLoading] = useState(false);
  const [loadingSlots, setLoadingSlots] = useState(!isDemoMode);
  const [selectedProposal, setSelectedProposal] = useState<string>('prop-1');
  const [transportMode, setTransportMode] = useState<'sedan' | 'transit'>('sedan');
  const [isUrgent, setIsUrgent] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);

  // Location state
  const [locationQuery, setLocationQuery] = useState('');
  const [locationSuggestions, setLocationSuggestions] = useState<LocationSuggestion[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<LocationSuggestion | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [travelTime, setTravelTime] = useState<{ minutes: number; distanceKm: number } | null>(null);
  const [businessHours, setBusinessHours] = useState<{ isOpen: boolean; weekdayText?: string[] } | null>(null);
  const [homeLocation, setHomeLocation] = useState<{ lat: number; lng: number; address: string } | null>(null);

  // Parse the input for date, time, and location
  const parsedInput = useMemo(() => {
    return parseNaturalLanguage(taskTitle as string || '');
  }, [taskTitle]);

  // Initialize location from parsed input
  useEffect(() => {
    if (parsedInput.location && !selectedLocation) {
      setLocationQuery(parsedInput.location);
    }
  }, [parsedInput.location]);

  // Fetch real events from API
  useEffect(() => {
    if (isDemoMode) {
      setLoadingSlots(false);
      return;
    }

    const fetchEvents = async () => {
      const token = getAccessToken();
      if (!token) {
        setLoadingSlots(false);
        return;
      }

      try {
        // Fetch events for the next 7 days
        const startDate = new Date().toISOString();
        const endDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
        const url = `${API_URL}/api/v1/events?startDate=${startDate}&endDate=${endDate}&limit=100`;

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          // API returns { events: [...], total, page, limit }
          setCalendarEvents(data.events || []);
        }
      } catch (err) {
        console.error('Failed to fetch events:', err);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchEvents();
  }, [isDemoMode]);

  // Fetch user's default home location
  useEffect(() => {
    if (isDemoMode) return;

    const fetchHomeLocation = async () => {
      const token = getAccessToken();
      if (!token) return;

      try {
        const response = await fetch(`${API_URL}/api/v1/locations`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          const defaultLoc = data.locations?.find((l: any) => l.isDefault);
          if (defaultLoc && defaultLoc.latitude && defaultLoc.longitude) {
            setHomeLocation({
              lat: defaultLoc.latitude,
              lng: defaultLoc.longitude,
              address: defaultLoc.address || defaultLoc.name || 'Home'
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch home location:', err);
      }
    };

    fetchHomeLocation();
  }, [isDemoMode]);

  // Search locations with debounce
  useEffect(() => {
    if (isDemoMode || locationQuery.length < 2) {
      setLocationSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      const token = getAccessToken();
      if (!token) return;

      setLoadingLocation(true);
      try {
        const response = await fetch(
          `${API_URL}/api/v1/locations/search?q=${encodeURIComponent(locationQuery)}`,
          {
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            credentials: 'include',
          }
        );

        if (response.ok) {
          const data = await response.json();
          setLocationSuggestions(data.suggestions || []);
        }
      } catch (err) {
        console.error('Failed to search locations:', err);
      } finally {
        setLoadingLocation(false);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timer);
  }, [locationQuery, isDemoMode]);

  // Calculate travel time when location is selected
  useEffect(() => {
    if (!selectedLocation || !homeLocation || isDemoMode) {
      setTravelTime(null);
      return;
    }

    // Need coordinates for the destination
    if (!selectedLocation.latitude || !selectedLocation.longitude) {
      // Fetch place details if needed
      const fetchDetails = async () => {
        const token = getAccessToken();
        if (!token) return;

        try {
          const response = await fetch(
            `${API_URL}/api/v1/locations/details/${selectedLocation.placeId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              credentials: 'include',
            }
          );

          if (response.ok) {
            const data = await response.json();
            if (data.latitude && data.longitude) {
              setSelectedLocation({
                ...selectedLocation,
                latitude: data.latitude,
                longitude: data.longitude,
              });
            }
          }
        } catch (err) {
          console.error('Failed to fetch place details:', err);
        }
      };

      fetchDetails();
      return;
    }

    // Calculate travel time
    const fetchTravelTime = async () => {
      const token = getAccessToken();
      if (!token) return;

      try {
        const mode = transportMode === 'transit' ? 'transit' : 'sedan';
        const url = `${API_URL}/api/v1/directions?fromLat=${homeLocation.lat}&fromLng=${homeLocation.lng}&toLat=${selectedLocation.latitude}&toLng=${selectedLocation.longitude}&mode=${mode}`;

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();
          setTravelTime({
            minutes: data.etaMinutes,
            distanceKm: data.distanceKm,
          });
        }
      } catch (err) {
        console.error('Failed to fetch travel time:', err);
      }
    };

    fetchTravelTime();
  }, [selectedLocation, homeLocation, transportMode, isDemoMode]);

  // Handle location selection - fetch details including opening hours
  const handleSelectLocation = async (suggestion: LocationSuggestion) => {
    setSelectedLocation(suggestion);
    setLocationQuery(suggestion.name);
    setLocationSuggestions([]);
    setBusinessHours(null); // Reset business hours

    // Fetch place details for opening hours if it's a Google Place
    if (!suggestion.placeId.startsWith('custom_') && !suggestion.placeId.startsWith('saved_')) {
      const token = getAccessToken();
      if (token) {
        try {
          const response = await fetch(
            `${API_URL}/api/v1/locations/details/${suggestion.placeId}`,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              credentials: 'include',
            }
          );
          if (response.ok) {
            const details = await response.json();
            console.log('Place details received:', details);

            // Update location with coordinates
            setSelectedLocation({
              ...suggestion,
              latitude: details.latitude,
              longitude: details.longitude,
            });

            // Set business hours separately
            if (details.openingHours) {
              console.log('Setting business hours:', details.openingHours);
              setBusinessHours(details.openingHours);
            }
          }
        } catch (err) {
          console.error('Failed to fetch place details:', err);
        }
      }
    }
  };

  // Generate proposals based on real calendar data or demo data
  const proposals = useMemo(() => {
    if (isDemoMode) {
      return generateDemoProposals(taskTitle as string || 'New Event');
    }

    const durationMinutes = parseInt(duration as string) || 60;
    let slots = calculateAvailableSlots(calendarEvents, durationMinutes, 7, isUrgent, parsedInput);

    // If no slots found, return a message proposal
    if (slots.length === 0) {
      let noSlotsMessage = isUrgent
        ? 'No slots available in the next 3 hours (all events are locked)'
        : 'No available slots found in the next 7 days';

      if (parsedInput.preferredDate) {
        const dayName = parsedInput.preferredDate.toLocaleDateString('en-US', { weekday: 'long' });
        noSlotsMessage = `No available slots on ${dayName}. Try a different day.`;
      }

      return [{
        id: 'prop-none',
        slotStart: new Date().toISOString(),
        slotEnd: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        departAt: new Date().toISOString(),
        travelMinutes: 0,
        confidence: 0,
        explanation: [noSlotsMessage],
        disruption: 'none' as const,
      }];
    }

    // Enhance slots with travel time, business hours, and weather
    if (travelTime || businessHours) {
      slots = slots.map(slot => {
        const slotDate = new Date(slot.slotStart);
        const dayOfWeek = slotDate.getDay(); // 0 = Sunday
        const dayIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert to weekdayText index

        // Update travel time from real data
        const actualTravelMinutes = travelTime?.minutes || slot.travelMinutes;

        // Calculate departure time
        const departAt = new Date(slotDate.getTime() - actualTravelMinutes * 60 * 1000);

        // Check business hours for this slot's day
        let isBusinessOpen = true;
        let hoursText = '';
        if (businessHours?.weekdayText) {
          hoursText = businessHours.weekdayText[dayIndex] || '';
          // Check if "Closed" is in the text for that day
          isBusinessOpen = !hoursText.toLowerCase().includes('closed');
        }

        // Update explanation with more details
        const explanation = [...slot.explanation];
        if (actualTravelMinutes > 0) {
          // Remove old travel explanation and add updated one
          const travelIdx = explanation.findIndex(e => e.includes('travel'));
          if (travelIdx >= 0) explanation.splice(travelIdx, 1);
          explanation.push(`${actualTravelMinutes} min travel time (real-time estimate)`);
        }
        if (!isBusinessOpen) {
          explanation.push(`⚠️ Place is closed on ${slotDate.toLocaleDateString('en-US', { weekday: 'long' })}`);
        }

        // Adjust confidence if business is closed
        let confidence = slot.confidence;
        if (!isBusinessOpen) {
          confidence = Math.max(0.3, confidence - 0.4);
        }

        return {
          ...slot,
          travelMinutes: actualTravelMinutes,
          departAt: departAt.toISOString(),
          explanation,
          confidence,
          businessOpen: isBusinessOpen,
          businessHoursText: hoursText,
        };
      });
    }

    return slots;
  }, [isDemoMode, taskTitle, calendarEvents, duration, isUrgent, parsedInput, travelTime, businessHours]);

  // Update selected proposal when proposals change
  useEffect(() => {
    if (proposals.length > 0 && !proposals.find(p => p.id === selectedProposal)) {
      setSelectedProposal(proposals[0].id);
    }
  }, [proposals]);

  const selected = proposals.find(p => p.id === selectedProposal) || proposals[0];

  const handleConfirm = async () => {
    if (isDemoMode) {
      // Demo mode - just simulate
      setLoading(true);
      setTimeout(() => {
        setLoading(false);
        router.replace('/(tabs)');
      }, 1500);
      return;
    }

    // Prevent double-clicks
    if (loading) return;

    const token = getAccessToken();
    if (!token) {
      Alert.alert('Error', 'Please sign in to create events');
      return;
    }

    // Check if we have a valid slot
    if (selected.id === 'prop-none' || selected.confidence === 0) {
      Alert.alert('No Available Slots', 'Please choose a custom time or try again later.');
      return;
    }

    // If urgent mode with conflicts, confirm with user
    if (isUrgent && selected.movedItems && selected.movedItems.length > 0) {
      Alert.alert(
        'Confirm Urgent Scheduling',
        `This will create a conflict with:\n\n${selected.movedItems.map(item => `• ${item}`).join('\n')}\n\nYou'll need to reschedule these events manually.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Schedule Anyway', style: 'destructive', onPress: () => createEvent() }
        ]
      );
      return;
    }

    createEvent();
  };

  const createEvent = async () => {
    // Prevent double submission
    if (loading) return;

    const token = getAccessToken();
    if (!token) return;

    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/v1/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          title: parsedInput.cleanTitle || taskTitle || 'New Event',
          startAt: selected.slotStart,
          endAt: selected.slotEnd,
          type: isUrgent ? 'urgent' : 'other',
          source: 'managed',
          priority: isUrgent ? 10 : 5,
          // Include location ID if it's a saved location
          locationId: selectedLocation?.placeId?.startsWith('saved_')
            ? selectedLocation.placeId.replace('saved_', '')
            : undefined,
          // Include location in notes
          notes: selectedLocation
            ? `Location: ${selectedLocation.name}${selectedLocation.address !== selectedLocation.name ? `\n${selectedLocation.address}` : ''}${travelTime ? `\nTravel: ${travelTime.minutes} min (${travelTime.distanceKm} km)` : ''}`
            : parsedInput.location
              ? `Location: ${parsedInput.location}`
              : undefined,
        }),
      });

      if (response.ok) {
        // Navigate immediately - don't wait for user to dismiss alert
        router.replace('/(tabs)');
        // Show brief success message
        Alert.alert('Scheduled!', isUrgent ? 'Urgent event created' : 'Event added to your calendar');
      } else {
        const error = await response.json();
        Alert.alert('Error', error.message || 'Failed to create event');
        setLoading(false);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create event');
      setLoading(false);
    }
    // Don't reset loading on success - we're navigating away
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return '#10b981';
    if (confidence >= 0.8) return '#3b82f6';
    if (confidence >= 0.7) return '#f59e0b';
    return '#ef4444';
  };

  const getDisruptionBadge = (disruption: string) => {
    const badges: Record<string, { bg: string; text: string }> = {
      none: { bg: '#10b981', text: 'No changes needed' },
      low: { bg: '#3b82f6', text: 'Minor adjustment' },
      medium: { bg: '#f59e0b', text: 'Some rescheduling' },
      high: { bg: '#ef4444', text: 'Major rescheduling' },
    };
    return badges[disruption] || badges.low;
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };
  };

  const formatDuration = (start: string, end: string) => {
    const diff = (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60);
    if (diff >= 60) return `${Math.floor(diff / 60)}h ${diff % 60}m`;
    return `${diff}m`;
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)');
          }
        }}>
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Proposals</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Task Info */}
      <View style={styles.taskInfo}>
        <Text style={styles.taskLabel}>Scheduling</Text>
        <Text style={styles.taskTitle}>{parsedInput.cleanTitle || taskTitle || 'New Event'}</Text>
      </View>

      {/* Detected Preferences */}
      {!isDemoMode && (parsedInput.preferredDate || parsedInput.preferredTimeStart !== undefined || parsedInput.location) && (
        <View style={styles.detectedSection}>
          <Text style={styles.detectedTitle}>Detected from your input:</Text>
          <View style={styles.detectedTags}>
            {parsedInput.preferredDate && (
              <View style={styles.detectedTag}>
                <Text style={styles.detectedTagIcon}>📅</Text>
                <Text style={styles.detectedTagText}>
                  {parsedInput.preferredDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </Text>
              </View>
            )}
            {parsedInput.preferredTimeStart !== undefined && (
              <View style={styles.detectedTag}>
                <Text style={styles.detectedTagIcon}>🕐</Text>
                <Text style={styles.detectedTagText}>
                  {parsedInput.preferredTimeStart > 12
                    ? `${parsedInput.preferredTimeStart - 12} PM`
                    : parsedInput.preferredTimeStart === 12
                      ? '12 PM'
                      : `${parsedInput.preferredTimeStart} AM`}
                  {parsedInput.preferredTimeEnd && parsedInput.preferredTimeEnd !== parsedInput.preferredTimeStart + 2
                    ? ` - ${parsedInput.preferredTimeEnd > 12 ? `${parsedInput.preferredTimeEnd - 12} PM` : `${parsedInput.preferredTimeEnd} AM`}`
                    : ''}
                </Text>
              </View>
            )}
            {parsedInput.location && (
              <View style={styles.detectedTag}>
                <Text style={styles.detectedTagIcon}>📍</Text>
                <Text style={styles.detectedTagText}>{parsedInput.location}</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Weather Alert */}
      {isDemoMode && DEMO_WEATHER.alerts.length > 0 && (
        <View style={styles.weatherAlert}>
          <Text style={styles.weatherIcon}>
            {DEMO_WEATHER.alerts[0].type === 'snow' ? '❄️' : '🌧️'}
          </Text>
          <View style={styles.weatherContent}>
            <Text style={styles.weatherTitle}>Weather Impact</Text>
            <Text style={styles.weatherText}>{DEMO_WEATHER.alerts[0].message}</Text>
          </View>
        </View>
      )}

      {/* Loading slots */}
      {loadingSlots && (
        <View style={styles.loadingSlots}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Finding available slots...</Text>
        </View>
      )}

      {!loadingSlots && (
        <View>
          {/* Transport Mode Toggle */}
          <View style={styles.transportSection}>
        <Text style={styles.sectionLabel}>Transport Mode</Text>
        <View style={styles.transportToggle}>
          <TouchableOpacity
            style={[styles.transportOption, transportMode === 'sedan' && styles.transportActive]}
            onPress={() => setTransportMode('sedan')}
          >
            <Text style={styles.transportIcon}>🚗</Text>
            <Text style={[styles.transportText, transportMode === 'sedan' && styles.transportTextActive]}>
              Drive
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.transportOption, transportMode === 'transit' && styles.transportActive]}
            onPress={() => setTransportMode('transit')}
          >
            <Text style={styles.transportIcon}>🚌</Text>
            <Text style={[styles.transportText, transportMode === 'transit' && styles.transportTextActive]}>
              Transit
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Urgency Toggle */}
      {!isDemoMode && (
        <View style={styles.urgencySection}>
          <TouchableOpacity
            style={[styles.urgencyToggle, isUrgent && styles.urgencyToggleActive]}
            onPress={() => setIsUrgent(!isUrgent)}
          >
            <Text style={styles.urgencyIcon}>⚡</Text>
            <View style={styles.urgencyContent}>
              <Text style={[styles.urgencyTitle, isUrgent && styles.urgencyTitleActive]}>
                Urgent - Next 3 Hours
              </Text>
              <Text style={[styles.urgencySubtext, isUrgent && styles.urgencySubtextActive]}>
                {isUrgent ? 'Will suggest moving non-locked events' : 'Tap to enable urgent scheduling'}
              </Text>
            </View>
            <View style={[styles.urgencyCheckbox, isUrgent && styles.urgencyCheckboxActive]}>
              {isUrgent && <Text style={styles.urgencyCheck}>✓</Text>}
            </View>
          </TouchableOpacity>
        </View>
      )}

      {/* Location Input */}
      {!isDemoMode && (
        <View style={styles.locationSection}>
          <Text style={styles.sectionLabel}>Location (optional)</Text>
          <View style={styles.locationInputContainer}>
            <Text style={styles.locationInputIcon}>📍</Text>
            <TextInput
              style={styles.locationInput}
              placeholder="Search for a place..."
              placeholderTextColor="#666"
              value={locationQuery}
              onChangeText={setLocationQuery}
            />
            {loadingLocation && <ActivityIndicator size="small" color="#3b82f6" />}
            {selectedLocation && (
              <TouchableOpacity onPress={() => {
                setSelectedLocation(null);
                setLocationQuery('');
                setTravelTime(null);
              }}>
                <Text style={styles.locationClear}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Location Suggestions */}
          {!selectedLocation && (locationSuggestions.length > 0 || (locationQuery.length >= 2 && !loadingLocation)) && (
            <View style={styles.locationSuggestions}>
              {/* Show API suggestions first */}
              {locationSuggestions.map((suggestion) => (
                <TouchableOpacity
                  key={suggestion.placeId}
                  style={styles.locationSuggestion}
                  onPress={() => handleSelectLocation(suggestion)}
                >
                  <Text style={styles.suggestionIcon}>
                    {suggestion.placeId.startsWith('saved_') ? '⭐' : '📍'}
                  </Text>
                  <View style={styles.suggestionContent}>
                    <Text style={styles.suggestionName}>{suggestion.name}</Text>
                    <Text style={styles.suggestionAddress} numberOfLines={1}>
                      {suggestion.address}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
              {/* Always show option to use typed text as custom location */}
              {locationQuery.length >= 2 && (
                <TouchableOpacity
                  style={[styles.locationSuggestion, styles.customLocationOption]}
                  onPress={() => handleSelectLocation({
                    placeId: `custom_${Date.now()}`,
                    name: locationQuery,
                    address: locationQuery,
                  })}
                >
                  <Text style={styles.suggestionIcon}>➕</Text>
                  <View style={styles.suggestionContent}>
                    <Text style={styles.suggestionName}>Use "{locationQuery}"</Text>
                    <Text style={styles.suggestionAddress}>Custom location</Text>
                  </View>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Travel Time Display */}
          {selectedLocation && travelTime && homeLocation && (
            <View style={styles.travelTimeCard}>
              <View style={styles.travelTimeRow}>
                <Text style={styles.travelTimeIcon}>
                  {transportMode === 'transit' ? '🚌' : '🚗'}
                </Text>
                <View style={styles.travelTimeContent}>
                  <Text style={styles.travelTimeLabel}>From: {homeLocation.address}</Text>
                  <Text style={styles.travelTimeValue}>
                    {travelTime.minutes} min • {travelTime.distanceKm.toFixed(1)} km
                  </Text>
                </View>
              </View>
              <Text style={styles.travelTimeNote}>
                To: {selectedLocation.name}
              </Text>
              {/* Business Hours - inline */}
              {businessHours && (
                <View style={[styles.businessHoursInline, !businessHours.isOpen && styles.businessHoursClosed]}>
                  <Text style={styles.businessHoursText}>
                    {businessHours.isOpen ? '✅ Open now' : '⚠️ Closed now'}
                    {businessHours.weekdayText?.[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1] &&
                      ` • ${businessHours.weekdayText[new Date().getDay() === 0 ? 6 : new Date().getDay() - 1]}`
                    }
                  </Text>
                </View>
              )}
            </View>
          )}

          {selectedLocation && !travelTime && !homeLocation && (
            <View style={styles.travelTimeNote}>
              <Text style={styles.noHomeNote}>
                Set a home location in Settings to see travel times
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Proposal Cards */}
      <View style={styles.proposalsSection}>
        <Text style={styles.sectionLabel}>Available Slots</Text>

        {proposals.map((proposal, index) => {
          const isSelected = proposal.id === selectedProposal;
          const startInfo = formatDateTime(proposal.slotStart);
          const endInfo = formatDateTime(proposal.slotEnd);
          const departInfo = formatDateTime(proposal.departAt);
          const disruptionBadge = getDisruptionBadge(proposal.disruption);

          return (
            <TouchableOpacity
              key={proposal.id}
              style={[styles.proposalCard, isSelected && styles.proposalCardSelected]}
              onPress={() => setSelectedProposal(proposal.id)}
            >
              {/* Rank Badge */}
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>#{index + 1}</Text>
              </View>

              {/* Main Info */}
              <View style={styles.proposalMain}>
                <View style={styles.proposalHeader}>
                  <View style={styles.dateTimeRow}>
                    <Text style={styles.proposalDay}>{startInfo.day}</Text>
                    <Text style={styles.proposalDate}>{startInfo.date}</Text>
                  </View>
                  <View style={[styles.confidenceBadge, { backgroundColor: getConfidenceColor(proposal.confidence) }]}>
                    <Text style={styles.confidenceText}>
                      {Math.round(proposal.confidence * 100)}%
                    </Text>
                  </View>
                </View>

                <View style={styles.timeRow}>
                  <Text style={styles.proposalTime}>
                    {startInfo.time} - {endInfo.time}
                  </Text>
                  <Text style={styles.durationText}>
                    {formatDuration(proposal.slotStart, proposal.slotEnd)}
                  </Text>
                </View>

                {/* Travel Info */}
                <View style={styles.travelRow}>
                  <View style={styles.travelInfo}>
                    <Text style={styles.travelIcon}>🚗</Text>
                    <Text style={styles.travelText}>{proposal.travelMinutes} min</Text>
                  </View>
                  <View style={styles.leaveByInfo}>
                    <Text style={styles.leaveByLabel}>Leave by</Text>
                    <Text style={styles.leaveByTime}>{departInfo.time}</Text>
                  </View>
                </View>

                {/* Disruption Badge */}
                <View style={[styles.disruptionBadge, { backgroundColor: disruptionBadge.bg + '20' }]}>
                  <Text style={[styles.disruptionText, { color: disruptionBadge.bg }]}>
                    {disruptionBadge.text}
                  </Text>
                </View>

                {/* Business Hours Warning */}
                {proposal.businessOpen === false && (
                  <View style={styles.slotClosedWarning}>
                    <Text style={styles.slotClosedText}>
                      ⚠️ Closed: {proposal.businessHoursText || 'Check hours'}
                    </Text>
                  </View>
                )}

                {/* Moved Items */}
                {proposal.movedItems && proposal.movedItems.length > 0 && (
                  <View style={styles.movedSection}>
                    <Text style={styles.movedLabel}>Will reschedule:</Text>
                    {proposal.movedItems.map((item, i) => (
                      <Text key={i} style={styles.movedItem}>• {item}</Text>
                    ))}
                  </View>
                )}

                {/* Explanation (only for selected) */}
                {isSelected && (
                  <View style={styles.explanationSection}>
                    <Text style={styles.explanationTitle}>Why this slot?</Text>
                    {proposal.explanation.map((reason, i) => (
                      <View key={i} style={styles.reasonRow}>
                        <Text style={styles.checkmark}>✓</Text>
                        <Text style={styles.reasonText}>{reason}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>

              {/* Selection Indicator */}
              <View style={[styles.selectionIndicator, isSelected && styles.selectionActive]}>
                {isSelected && <Text style={styles.checkIcon}>✓</Text>}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirm}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Text style={styles.confirmText}>Confirm & Schedule</Text>
              <Text style={styles.confirmSubtext}>
                {formatDateTime(selected.slotStart).day}, {formatDateTime(selected.slotStart).date} at {formatDateTime(selected.slotStart).time}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.modifyButton} onPress={() => router.push({
          pathname: '/proposal/custom',
          params: { title: taskTitle }
        })}>
          <Text style={styles.modifyText}>Choose Custom Time</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => {
          if (router.canGoBack()) {
            router.back();
          } else {
            router.replace('/(tabs)');
          }
        }}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

          <View style={styles.bottomPadding} />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
  },
  backButton: {
    padding: 8,
  },
  backText: {
    color: '#3b82f6',
    fontSize: 16,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  placeholder: {
    width: 60,
  },
  taskInfo: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    alignItems: 'center',
  },
  taskLabel: {
    color: '#888',
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  taskTitle: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  detectedSection: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 14,
  },
  detectedTitle: {
    color: '#60a5fa',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  detectedTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  detectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d4a6f',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 6,
  },
  detectedTagIcon: {
    fontSize: 14,
  },
  detectedTagText: {
    color: '#93c5fd',
    fontSize: 14,
    fontWeight: '500',
  },
  weatherAlert: {
    flexDirection: 'row',
    backgroundColor: '#422006',
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
    alignItems: 'center',
  },
  weatherIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  weatherContent: {
    flex: 1,
  },
  weatherTitle: {
    color: '#fbbf24',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  weatherText: {
    color: '#fcd34d',
    fontSize: 13,
  },
  transportSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionLabel: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  transportToggle: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 4,
  },
  transportOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  transportActive: {
    backgroundColor: '#3b82f6',
  },
  transportIcon: {
    fontSize: 18,
  },
  transportText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '500',
  },
  transportTextActive: {
    color: '#fff',
  },
  urgencySection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  urgencyToggle: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  urgencyToggleActive: {
    backgroundColor: '#7f1d1d',
    borderColor: '#ef4444',
  },
  urgencyIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  urgencyContent: {
    flex: 1,
  },
  urgencyTitle: {
    color: '#888',
    fontSize: 15,
    fontWeight: '600',
  },
  urgencyTitleActive: {
    color: '#fff',
  },
  urgencySubtext: {
    color: '#666',
    fontSize: 12,
    marginTop: 2,
  },
  urgencySubtextActive: {
    color: '#fca5a5',
  },
  urgencyCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
  },
  urgencyCheckboxActive: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  urgencyCheck: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  locationSection: {
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  locationInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  locationInputIcon: {
    fontSize: 18,
    marginRight: 10,
  },
  locationInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingVertical: 12,
  },
  locationClear: {
    color: '#888',
    fontSize: 18,
    padding: 8,
  },
  locationSuggestions: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  locationSuggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d5c',
  },
  customLocationOption: {
    backgroundColor: '#1a1a2e',
    borderBottomWidth: 0,
  },
  suggestionIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  suggestionContent: {
    flex: 1,
  },
  suggestionName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  suggestionAddress: {
    color: '#888',
    fontSize: 13,
    marginTop: 2,
  },
  travelTimeCard: {
    backgroundColor: '#1e3a5f',
    borderRadius: 12,
    padding: 14,
    marginTop: 12,
  },
  travelTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  travelTimeIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  travelTimeContent: {
    flex: 1,
  },
  travelTimeLabel: {
    color: '#60a5fa',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  travelTimeValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 2,
  },
  travelTimeNote: {
    color: '#93c5fd',
    fontSize: 12,
    marginTop: 10,
  },
  businessHoursInline: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#3b82f680',
  },
  businessHoursClosed: {
    borderTopColor: '#ef444480',
  },
  businessHoursText: {
    color: '#fbbf24',
    fontSize: 13,
  },
  noHomeNote: {
    color: '#888',
    fontSize: 13,
    fontStyle: 'italic',
    marginTop: 8,
  },
  closedWarning: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
    padding: 12,
    marginTop: 12,
  },
  closedWarningIcon: {
    fontSize: 20,
    marginRight: 10,
  },
  closedWarningText: {
    color: '#fca5a5',
    fontSize: 14,
    fontWeight: '600',
  },
  closedWarningHours: {
    color: '#f87171',
    fontSize: 12,
    marginTop: 2,
  },
  proposalsSection: {
    paddingHorizontal: 16,
  },
  proposalCard: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  proposalCardSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#2a2a4a',
  },
  rankBadge: {
    width: 36,
    backgroundColor: '#3d3d5c',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },
  proposalMain: {
    flex: 1,
    padding: 14,
  },
  proposalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  dateTimeRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  proposalDay: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  proposalDate: {
    color: '#888',
    fontSize: 14,
  },
  confidenceBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  confidenceText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  proposalTime: {
    color: '#3b82f6',
    fontSize: 18,
    fontWeight: 'bold',
  },
  durationText: {
    color: '#888',
    fontSize: 13,
  },
  travelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#3d3d5c',
    marginBottom: 10,
  },
  travelInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  travelIcon: {
    fontSize: 14,
  },
  travelText: {
    color: '#888',
    fontSize: 14,
  },
  leaveByInfo: {
    alignItems: 'flex-end',
  },
  leaveByLabel: {
    color: '#666',
    fontSize: 11,
    textTransform: 'uppercase',
  },
  leaveByTime: {
    color: '#f59e0b',
    fontSize: 14,
    fontWeight: '600',
  },
  disruptionBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  disruptionText: {
    fontSize: 12,
    fontWeight: '500',
  },
  slotClosedWarning: {
    backgroundColor: '#7f1d1d40',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    marginBottom: 8,
  },
  slotClosedText: {
    color: '#fca5a5',
    fontSize: 12,
    fontWeight: '500',
  },
  movedSection: {
    backgroundColor: '#3d3d5c',
    padding: 10,
    borderRadius: 8,
    marginTop: 4,
  },
  movedLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  movedItem: {
    color: '#f59e0b',
    fontSize: 13,
  },
  explanationSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#3d3d5c',
  },
  explanationTitle: {
    color: '#888',
    fontSize: 12,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  reasonRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  checkmark: {
    color: '#10b981',
    fontSize: 14,
    marginRight: 8,
    fontWeight: 'bold',
  },
  reasonText: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
  },
  selectionIndicator: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#3d3d5c',
  },
  selectionActive: {
    backgroundColor: '#3b82f6',
  },
  checkIcon: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actions: {
    paddingHorizontal: 16,
    paddingTop: 24,
    gap: 12,
  },
  confirmButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '600',
  },
  confirmSubtext: {
    color: '#93c5fd',
    fontSize: 13,
    marginTop: 2,
  },
  modifyButton: {
    backgroundColor: '#2d2d44',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  modifyText: {
    color: '#fff',
    fontSize: 16,
  },
  cancelButton: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelText: {
    color: '#888',
    fontSize: 15,
  },
  bottomPadding: {
    height: 40,
  },
  loadingSlots: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  loadingText: {
    color: '#888',
    fontSize: 16,
    marginTop: 16,
  },
});
