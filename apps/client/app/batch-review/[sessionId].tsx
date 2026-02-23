import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Platform, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect } from 'react';
import { useThemeStore } from '../../src/store/themeStore';

interface ModalState {
  visible: boolean;
  type: 'success' | 'error';
  title: string;
  message: string;
  onClose?: () => void;
}

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const getAccessToken = (): string | null => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('accessToken');
  }
  return null;
};

interface ExtractedContact {
  name: string;
  email?: string;
  phone?: string;
  category: string;
  confidence: number;
  existingMatch?: { id: string; name: string; email?: string };
  similarMatches?: Array<{ id: string; name: string; similarity: number }>;
  isNew: boolean;
}

interface ProposedSlot {
  id: string;
  startAt: string;
  endAt: string;
  confidence: number;
  explanation: string[];
}

interface SimilarEvent {
  id: string;
  title: string;
  startAt: string;
  endAt: string;
  similarity: number;
  conflictType: 'duplicate' | 'similar' | 'time_conflict';
}

interface ExtractedEvent {
  title: string;
  type: string;
  durationMinutes: number;
  locationText?: string;
  participants: string[];
  priority: number;
  confidence: number;
  proposals: ProposedSlot[];
  similarEvents?: SimilarEvent[];
}

interface SessionData {
  sessionId: string;
  extractedEvents: ExtractedEvent[];
  extractedContacts: ExtractedContact[];
  warnings: string[];
}

interface ContactDecision {
  save: boolean;
  merge?: string;
  overrides?: { name?: string; email?: string; phone?: string };
}

interface EventDecision {
  skip: boolean;
  proposalId?: string;
  overrides?: { title?: string; notes?: string };
}

type Step = 'contacts' | 'events' | 'confirm';

export default function BatchReviewScreen() {
  const { sessionId } = useLocalSearchParams();
  const router = useRouter();
  const { colors } = useThemeStore();

  const [step, setStep] = useState<Step>('contacts');
  const [loading, setLoading] = useState(true);
  const [committing, setCommitting] = useState(false);
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [contactDecisions, setContactDecisions] = useState<Map<number, ContactDecision>>(new Map());
  const [eventDecisions, setEventDecisions] = useState<Map<number, EventDecision>>(new Map());
  const [modal, setModal] = useState<ModalState>({
    visible: false,
    type: 'success',
    title: '',
    message: '',
  });

  const showModal = (type: 'success' | 'error', title: string, message: string, onClose?: () => void) => {
    setModal({ visible: true, type, title, message, onClose });
  };

  const closeModal = () => {
    const onClose = modal.onClose;
    setModal({ ...modal, visible: false });
    if (onClose) onClose();
  };

  useEffect(() => {
    fetchSession();
  }, [sessionId]);

  const fetchSession = async () => {
    try {
      const token = getAccessToken();
      const response = await fetch(`${API_URL}/api/v1/planner/batch/session/${sessionId}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });

      if (!response.ok) throw new Error('Failed to fetch session');

      const data = await response.json();
      const extracted = data.extractedData as { events: ExtractedEvent[]; contacts: ExtractedContact[] };

      setSessionData({
        sessionId: data.id,
        extractedEvents: extracted.events || [],
        extractedContacts: extracted.contacts || [],
        warnings: [],
      });

      // Initialize decisions
      const initialContactDecisions = new Map<number, ContactDecision>();
      (extracted.contacts || []).forEach((_, index) => {
        initialContactDecisions.set(index, { save: true });
      });
      setContactDecisions(initialContactDecisions);

      const initialEventDecisions = new Map<number, EventDecision>();
      (extracted.events || []).forEach((event, index) => {
        initialEventDecisions.set(index, {
          skip: false,
          proposalId: event.proposals[0]?.id,
        });
      });
      setEventDecisions(initialEventDecisions);
    } catch (error) {
      console.error('Error fetching session:', error);
      showModal('error', 'Error', 'Failed to load session', () => router.back());
    } finally {
      setLoading(false);
    }
  };

  const handleCommit = async () => {
    if (!sessionData) return;

    setCommitting(true);

    try {
      const token = getAccessToken();

      const events = Array.from(eventDecisions.entries()).map(([index, decision]) => ({
        index,
        proposalId: decision.proposalId,
        overrides: decision.overrides,
        skip: decision.skip,
      }));

      const contacts = Array.from(contactDecisions.entries()).map(([index, decision]) => ({
        index,
        save: decision.save,
        merge: decision.merge,
        overrides: decision.overrides,
      }));

      const response = await fetch(`${API_URL}/api/v1/planner/batch/commit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          sessionId,
          events,
          contacts,
        }),
      });

      if (!response.ok) throw new Error('Failed to commit');

      const result = await response.json();

      showModal(
        'success',
        'Success!',
        `${result.createdEvents.length} event${result.createdEvents.length !== 1 ? 's' : ''} added to calendar\n${result.savedContacts.length} contact${result.savedContacts.length !== 1 ? 's' : ''} saved`,
        () => router.replace('/(tabs)')
      );
    } catch (error) {
      console.error('Commit error:', error);
      showModal('error', 'Error', 'Failed to save. Please try again.');
    } finally {
      setCommitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      const token = getAccessToken();
      await fetch(`${API_URL}/api/v1/planner/batch/session/${sessionId}`, {
        method: 'DELETE',
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      });
    } catch (error) {
      console.error('Cancel error:', error);
    }

    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)');
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      time: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    };
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.loadingText, { color: colors.text }]}>Loading session...</Text>
      </View>
    );
  }

  if (!sessionData) {
    return (
      <View style={[styles.container, styles.centered, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorText, { color: colors.error }]}>Session not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const contactsToSave = Array.from(contactDecisions.values()).filter(d => d.save).length;
  const eventsToAdd = Array.from(eventDecisions.values()).filter(d => !d.skip).length;

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Batch Review</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Progress Steps */}
      <View style={styles.progressContainer}>
        <View style={styles.progressSteps}>
          <TouchableOpacity
            style={[styles.progressStep, step === 'contacts' && styles.progressStepActive]}
            onPress={() => setStep('contacts')}
          >
            <View style={[styles.stepDot, step === 'contacts' && styles.stepDotActive]} />
            <Text style={[styles.stepLabel, step === 'contacts' && styles.stepLabelActive]}>
              Contacts ({sessionData.extractedContacts.length})
            </Text>
          </TouchableOpacity>
          <View style={styles.progressLine} />
          <TouchableOpacity
            style={[styles.progressStep, step === 'events' && styles.progressStepActive]}
            onPress={() => setStep('events')}
          >
            <View style={[styles.stepDot, step === 'events' && styles.stepDotActive]} />
            <Text style={[styles.stepLabel, step === 'events' && styles.stepLabelActive]}>
              Events ({sessionData.extractedEvents.length})
            </Text>
          </TouchableOpacity>
          <View style={styles.progressLine} />
          <TouchableOpacity
            style={[styles.progressStep, step === 'confirm' && styles.progressStepActive]}
            onPress={() => setStep('confirm')}
          >
            <View style={[styles.stepDot, step === 'confirm' && styles.stepDotActive]} />
            <Text style={[styles.stepLabel, step === 'confirm' && styles.stepLabelActive]}>
              Confirm
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Step 1: Contacts */}
        {step === 'contacts' && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Review Contacts</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
              {sessionData.extractedContacts.length} people found. Choose which to save.
            </Text>

            {sessionData.extractedContacts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No contacts extracted</Text>
              </View>
            ) : (
              sessionData.extractedContacts.map((contact, index) => {
                const decision = contactDecisions.get(index) || { save: true };
                return (
                  <View key={index} style={[styles.card, { backgroundColor: colors.card }]}>
                    <View style={styles.cardHeader}>
                      <View style={styles.contactInfo}>
                        <Text style={[styles.contactName, { color: colors.text }]}>{contact.name}</Text>
                        {contact.email && (
                          <Text style={[styles.contactDetail, { color: colors.textMuted }]}>{contact.email}</Text>
                        )}
                        {contact.phone && (
                          <Text style={[styles.contactDetail, { color: colors.textMuted }]}>{contact.phone}</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[styles.toggleButton, decision.save && styles.toggleButtonActive]}
                        onPress={() => {
                          const newDecisions = new Map(contactDecisions);
                          newDecisions.set(index, { ...decision, save: !decision.save });
                          setContactDecisions(newDecisions);
                        }}
                      >
                        <Text style={[styles.toggleText, decision.save && styles.toggleTextActive]}>
                          {decision.save ? 'Save' : 'Skip'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {contact.existingMatch && (
                      <View style={styles.matchSection}>
                        <Text style={styles.matchLabel}>Existing contact found:</Text>
                        <TouchableOpacity
                          style={[styles.mergeButton, decision.merge && styles.mergeButtonActive]}
                          onPress={() => {
                            const newDecisions = new Map(contactDecisions);
                            newDecisions.set(index, {
                              ...decision,
                              merge: decision.merge ? undefined : contact.existingMatch!.id,
                            });
                            setContactDecisions(newDecisions);
                          }}
                        >
                          <Text style={styles.mergeText}>
                            {decision.merge ? '✓ Merge with' : 'Merge with'} {contact.existingMatch.name}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}

                    <View style={styles.confidenceBar}>
                      <View style={[styles.confidenceFill, { width: `${contact.confidence * 100}%` }]} />
                      <Text style={styles.confidenceText}>{Math.round(contact.confidence * 100)}% confident</Text>
                    </View>
                  </View>
                );
              })
            )}

            <TouchableOpacity style={styles.nextButton} onPress={() => setStep('events')}>
              <Text style={styles.nextButtonText}>Continue to Events</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 2: Events */}
        {step === 'events' && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Review Events</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
              {sessionData.extractedEvents.length} events found. Select time slots.
            </Text>

            {sessionData.extractedEvents.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyText}>No events extracted</Text>
              </View>
            ) : (
              sessionData.extractedEvents.map((event, index) => {
                const decision = eventDecisions.get(index) || { skip: false };
                return (
                  <View key={index} style={[styles.card, { backgroundColor: colors.card }]}>
                    <View style={styles.cardHeader}>
                      <View style={styles.eventInfo}>
                        <Text style={[styles.eventTitle, { color: colors.text }]}>{event.title}</Text>
                        <View style={styles.eventMeta}>
                          <Text style={[styles.metaText, { color: colors.textMuted }]}>
                            {event.durationMinutes} min
                          </Text>
                          {event.locationText && (
                            <Text style={[styles.metaText, { color: colors.textMuted }]}>
                              📍 {event.locationText}
                            </Text>
                          )}
                        </View>
                        {event.participants.length > 0 && (
                          <Text style={[styles.participants, { color: colors.textMuted }]}>
                            👥 {event.participants.join(', ')}
                          </Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={[styles.toggleButton, !decision.skip && styles.toggleButtonActive]}
                        onPress={() => {
                          const newDecisions = new Map(eventDecisions);
                          newDecisions.set(index, { ...decision, skip: !decision.skip });
                          setEventDecisions(newDecisions);
                        }}
                      >
                        <Text style={[styles.toggleText, !decision.skip && styles.toggleTextActive]}>
                          {decision.skip ? 'Skipped' : 'Include'}
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Similar Events Warning */}
                    {event.similarEvents && event.similarEvents.length > 0 && (
                      <View style={styles.warningSection}>
                        {event.similarEvents.map((similar, idx) => {
                          const warningIcon = similar.conflictType === 'time_conflict' ? '⚠️' :
                                             similar.conflictType === 'duplicate' ? '🔄' : '💡';
                          const warningLabel = similar.conflictType === 'time_conflict' ? 'Time conflict' :
                                              similar.conflictType === 'duplicate' ? 'Possible duplicate' : 'Similar event';
                          const similarDt = formatDateTime(similar.startAt);
                          return (
                            <View key={idx} style={styles.warningItem}>
                              <Text style={styles.warningIcon}>{warningIcon}</Text>
                              <View style={styles.warningContent}>
                                <Text style={styles.warningLabel}>{warningLabel}</Text>
                                <Text style={styles.warningText}>
                                  "{similar.title}" on {similarDt.day}, {similarDt.date}
                                </Text>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    )}

                    {!decision.skip && event.proposals.length > 0 && (
                      <View style={styles.proposalsSection}>
                        <Text style={styles.proposalsLabel}>Time slots:</Text>
                        {event.proposals.slice(0, 3).map((proposal) => {
                          const dt = formatDateTime(proposal.startAt);
                          const isSelected = decision.proposalId === proposal.id;
                          return (
                            <TouchableOpacity
                              key={proposal.id}
                              style={[styles.proposalOption, isSelected && styles.proposalSelected]}
                              onPress={() => {
                                const newDecisions = new Map(eventDecisions);
                                newDecisions.set(index, { ...decision, proposalId: proposal.id });
                                setEventDecisions(newDecisions);
                              }}
                            >
                              <Text style={[styles.proposalTime, isSelected && styles.proposalTimeSelected]}>
                                {dt.day}, {dt.date} at {dt.time}
                              </Text>
                              <Text style={styles.proposalConfidence}>
                                {Math.round(proposal.confidence * 100)}%
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    <View style={styles.confidenceBar}>
                      <View style={[styles.confidenceFill, { width: `${event.confidence * 100}%` }]} />
                      <Text style={styles.confidenceText}>{Math.round(event.confidence * 100)}% confident</Text>
                    </View>
                  </View>
                );
              })
            )}

            <View style={styles.navButtons}>
              <TouchableOpacity style={styles.backNavButton} onPress={() => setStep('contacts')}>
                <Text style={styles.backNavText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.primaryNavButton} onPress={() => setStep('confirm')}>
                <Text style={styles.primaryNavText}>Review & Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Step 3: Confirm */}
        {step === 'confirm' && (
          <View style={styles.stepContent}>
            <Text style={[styles.stepTitle, { color: colors.text }]}>Confirm & Add</Text>
            <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>
              Review what will be added to your calendar
            </Text>

            <View style={[styles.summaryCard, { backgroundColor: colors.card }]}>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.text }]}>Events to add</Text>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>{eventsToAdd}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryLabel, { color: colors.text }]}>Contacts to save</Text>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>{contactsToSave}</Text>
              </View>
            </View>

            {eventsToAdd > 0 && (
              <View style={styles.confirmSection}>
                <Text style={[styles.confirmSectionTitle, { color: colors.text }]}>Events</Text>
                {sessionData.extractedEvents.map((event, index) => {
                  const decision = eventDecisions.get(index);
                  if (decision?.skip) return null;
                  const proposal = event.proposals.find(p => p.id === decision?.proposalId) || event.proposals[0];
                  const dt = proposal ? formatDateTime(proposal.startAt) : null;
                  return (
                    <View key={index} style={styles.confirmItem}>
                      <Text style={[styles.confirmItemTitle, { color: colors.text }]}>{event.title}</Text>
                      {dt && (
                        <Text style={[styles.confirmItemMeta, { color: colors.textMuted }]}>
                          {dt.day}, {dt.date} at {dt.time}
                        </Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {contactsToSave > 0 && (
              <View style={styles.confirmSection}>
                <Text style={[styles.confirmSectionTitle, { color: colors.text }]}>Contacts</Text>
                {sessionData.extractedContacts.map((contact, index) => {
                  const decision = contactDecisions.get(index);
                  if (!decision?.save) return null;
                  return (
                    <View key={index} style={styles.confirmItem}>
                      <Text style={[styles.confirmItemTitle, { color: colors.text }]}>{contact.name}</Text>
                      {contact.email && (
                        <Text style={[styles.confirmItemMeta, { color: colors.textMuted }]}>{contact.email}</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.navButtons}>
              <TouchableOpacity style={styles.backNavButton} onPress={() => setStep('events')}>
                <Text style={styles.backNavText}>Back</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.commitButton, committing && styles.commitButtonDisabled]}
                onPress={handleCommit}
                disabled={committing}
              >
                {committing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.commitButtonText}>Add {eventsToAdd} Events to Calendar</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>

      {/* Custom Modal */}
      <Modal
        visible={modal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[
              styles.modalIcon,
              { backgroundColor: modal.type === 'success' ? '#22c55e20' : '#ef444420' }
            ]}>
              <Text style={[
                styles.modalIconText,
                { color: modal.type === 'success' ? '#22c55e' : '#ef4444' }
              ]}>
                {modal.type === 'success' ? '✓' : '✕'}
              </Text>
            </View>
            <Text style={[styles.modalTitle, { color: colors.text }]}>{modal.title}</Text>
            <Text style={[styles.modalMessage, { color: colors.textMuted }]}>{modal.message}</Text>
            <TouchableOpacity
              style={[
                styles.modalButton,
                { backgroundColor: modal.type === 'success' ? '#22c55e' : '#3b82f6' }
              ]}
              onPress={closeModal}
            >
              <Text style={styles.modalButtonText}>OK</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
  },
  errorText: {
    fontSize: 18,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 56 : 12,
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 4,
  },
  cancelText: {
    color: '#3b82f6',
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  placeholder: {
    width: 60,
  },
  progressContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  progressSteps: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressStep: {
    alignItems: 'center',
  },
  progressStepActive: {},
  stepDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#3d3d5c',
    marginBottom: 6,
  },
  stepDotActive: {
    backgroundColor: '#3b82f6',
  },
  stepLabel: {
    fontSize: 12,
    color: '#888',
  },
  stepLabelActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  progressLine: {
    width: 40,
    height: 2,
    backgroundColor: '#3d3d5c',
    marginHorizontal: 8,
    marginBottom: 20,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  stepContent: {
    paddingTop: 8,
  },
  stepTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  stepSubtitle: {
    fontSize: 15,
    marginBottom: 20,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    color: '#888',
    fontSize: 16,
  },
  card: {
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  contactInfo: {
    flex: 1,
    marginRight: 12,
  },
  contactName: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  contactDetail: {
    fontSize: 14,
    marginBottom: 2,
  },
  eventInfo: {
    flex: 1,
    marginRight: 12,
  },
  eventTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 6,
  },
  eventMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  metaText: {
    fontSize: 13,
  },
  participants: {
    fontSize: 13,
    marginTop: 4,
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#3d3d5c',
  },
  toggleButtonActive: {
    backgroundColor: '#3b82f6',
  },
  toggleText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  toggleTextActive: {
    color: '#fff',
  },
  matchSection: {
    marginBottom: 12,
  },
  matchLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 6,
  },
  mergeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#3d3d5c',
    alignSelf: 'flex-start',
  },
  mergeButtonActive: {
    backgroundColor: '#22c55e',
  },
  mergeText: {
    color: '#fff',
    fontSize: 13,
  },
  confidenceBar: {
    height: 4,
    backgroundColor: '#3d3d5c',
    borderRadius: 2,
    overflow: 'hidden',
    marginTop: 8,
  },
  confidenceFill: {
    height: '100%',
    backgroundColor: '#22c55e',
    borderRadius: 2,
  },
  confidenceText: {
    position: 'absolute',
    right: 0,
    top: -18,
    fontSize: 11,
    color: '#888',
  },
  warningSection: {
    marginBottom: 12,
    padding: 10,
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderRadius: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#fbbf24',
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  warningIcon: {
    fontSize: 14,
    marginRight: 8,
    marginTop: 2,
  },
  warningContent: {
    flex: 1,
  },
  warningLabel: {
    color: '#fbbf24',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 2,
  },
  warningText: {
    color: '#d4a013',
    fontSize: 13,
  },
  proposalsSection: {
    marginBottom: 12,
  },
  proposalsLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 8,
  },
  proposalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#3d3d5c',
    marginBottom: 6,
  },
  proposalSelected: {
    backgroundColor: '#1e3a5f',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  proposalTime: {
    color: '#ccc',
    fontSize: 14,
  },
  proposalTimeSelected: {
    color: '#fff',
    fontWeight: '500',
  },
  proposalConfidence: {
    color: '#888',
    fontSize: 12,
  },
  nextButton: {
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 20,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  navButtons: {
    flexDirection: 'row',
    marginTop: 20,
    marginBottom: 10,
  },
  backNavButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3d3d5c',
    marginRight: 8,
  },
  backNavText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  primaryNavButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    marginLeft: 8,
  },
  primaryNavText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  summaryCard: {
    borderRadius: 14,
    padding: 20,
    marginBottom: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 16,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  confirmSection: {
    marginBottom: 20,
  },
  confirmSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  confirmItem: {
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#3d3d5c',
  },
  confirmItemTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  confirmItemMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  commitButton: {
    flex: 1,
    backgroundColor: '#22c55e',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  commitButtonDisabled: {
    backgroundColor: '#166534',
  },
  commitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContent: {
    width: '100%',
    maxWidth: 340,
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
  },
  modalIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalIconText: {
    fontSize: 28,
    fontWeight: 'bold',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  modalButton: {
    paddingVertical: 14,
    paddingHorizontal: 48,
    borderRadius: 12,
    minWidth: 140,
    alignItems: 'center',
  },
  modalButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
