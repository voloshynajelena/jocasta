import { YStack, XStack, Text, Card } from 'tamagui';
import { MapPin, Clock, Car, AlertCircle } from '@tamagui/lucide-icons';

interface Event {
  id: string;
  title: string;
  type: string;
  startAt: string;
  endAt: string;
  location?: {
    name: string;
    address: string;
  } | null;
  isLocked: boolean;
  priority: number;
  travelSegment?: {
    etaMinutes: number;
    departAt: string;
    mode: string;
  } | null;
}

interface EventCardProps {
  event: Event;
  isPast?: boolean;
  compact?: boolean;
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  appointment: '$blue10',
  client_training: '$green10',
  personal_workout: '$orange10',
  dog_walk: '$purple10',
  kids_dropoff: '$pink10',
  kids_pickup: '$pink10',
  fueling: '$gray10',
  shopping: '$yellow10',
  home_chores: '$gray10',
  meeting: '$blue10',
  travel_block: '$gray10',
  other: '$gray10',
};

export function EventCard({ event, isPast, compact }: EventCardProps) {
  const startTime = new Date(event.startAt);
  const endTime = new Date(event.endAt);

  const formatTime = (date: Date) =>
    date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

  const durationMinutes = Math.round(
    (endTime.getTime() - startTime.getTime()) / (1000 * 60),
  );

  const typeColor = EVENT_TYPE_COLORS[event.type] || '$gray10';

  if (compact) {
    return (
      <Card
        padding="$3"
        opacity={isPast ? 0.6 : 1}
        borderLeftWidth={3}
        borderLeftColor={typeColor}
      >
        <XStack justifyContent="space-between" alignItems="center">
          <XStack gap="$2" alignItems="center" flex={1}>
            <Text fontWeight="bold" numberOfLines={1} flex={1}>
              {event.title}
            </Text>
          </XStack>
          <XStack gap="$2" alignItems="center">
            <Text color="$gray10" fontSize="$2">
              {formatTime(startTime)}
            </Text>
            {event.isLocked && <AlertCircle size={14} color="$orange10" />}
          </XStack>
        </XStack>
      </Card>
    );
  }

  return (
    <Card
      padding="$4"
      opacity={isPast ? 0.6 : 1}
      borderLeftWidth={4}
      borderLeftColor={typeColor}
    >
      <YStack gap="$2">
        {/* Travel Info */}
        {event.travelSegment && !isPast && (
          <XStack
            backgroundColor="$blue2"
            padding="$2"
            borderRadius="$2"
            gap="$2"
            alignItems="center"
            marginBottom="$1"
          >
            <Car size={16} color="$blue10" />
            <Text color="$blue10" fontSize="$2" fontWeight="bold">
              Leave by {formatTime(new Date(event.travelSegment.departAt))}
            </Text>
            <Text color="$blue10" fontSize="$2">
              ({event.travelSegment.etaMinutes} min drive)
            </Text>
          </XStack>
        )}

        {/* Header */}
        <XStack justifyContent="space-between" alignItems="flex-start">
          <YStack flex={1} gap="$1">
            <Text fontSize="$5" fontWeight="bold" numberOfLines={2}>
              {event.title}
            </Text>
            <XStack gap="$2" alignItems="center">
              <Clock size={14} color="$gray10" />
              <Text color="$gray10" fontSize="$3">
                {formatTime(startTime)} - {formatTime(endTime)}
              </Text>
              <Text color="$gray10" fontSize="$2">
                ({durationMinutes} min)
              </Text>
            </XStack>
          </YStack>

          <XStack gap="$1" alignItems="center">
            {event.isLocked && (
              <Text
                fontSize="$2"
                backgroundColor="$orange5"
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius="$2"
                color="$orange10"
              >
                Locked
              </Text>
            )}
            {event.priority === 1 && (
              <Text
                fontSize="$2"
                backgroundColor="$red5"
                paddingHorizontal="$2"
                paddingVertical="$1"
                borderRadius="$2"
                color="$red10"
              >
                High
              </Text>
            )}
          </XStack>
        </XStack>

        {/* Location */}
        {event.location && (
          <XStack gap="$2" alignItems="center" marginTop="$1">
            <MapPin size={14} color="$gray10" />
            <Text color="$gray11" fontSize="$3" numberOfLines={1} flex={1}>
              {event.location.name}
            </Text>
          </XStack>
        )}
      </YStack>
    </Card>
  );
}
