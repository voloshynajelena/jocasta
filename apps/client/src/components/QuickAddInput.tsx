import { useState } from 'react';
import { YStack, XStack, Input, Button, Spinner, Text, Card, Sheet } from 'tamagui';
import { Send, X, Check, Clock, MapPin, AlertTriangle } from '@tamagui/lucide-icons';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Keyboard } from 'react-native';

import { api } from '@/services/api';

interface Proposal {
  id: string;
  rank: number;
  startAt: string;
  endAt: string;
  travelDepartTime: string | null;
  travelMode: string | null;
  travelEtaMinutes: number | null;
  confidence: number;
  explanation: string[];
  weatherWarning: string | null;
}

interface ExtractedIntent {
  kind: string;
  title: string;
  type: string;
  durationMinutes: number;
  locationText?: string;
}

export function QuickAddInput() {
  const [text, setText] = useState('');
  const [showProposals, setShowProposals] = useState(false);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [intent, setIntent] = useState<ExtractedIntent | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const queryClient = useQueryClient();

  const proposeMutation = useMutation({
    mutationFn: (text: string) => api.propose(text),
    onSuccess: (data) => {
      setProposals(data.proposals);
      setIntent(data.extractedIntent);
      setWarnings(data.warnings);
      setShowProposals(true);
      Keyboard.dismiss();
    },
  });

  const commitMutation = useMutation({
    mutationFn: (proposalId: string) => api.commitProposal(proposalId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      setShowProposals(false);
      setText('');
      setProposals([]);
      setIntent(null);
    },
  });

  const handleSubmit = () => {
    if (text.trim()) {
      proposeMutation.mutate(text.trim());
    }
  };

  const handleAccept = (proposalId: string) => {
    commitMutation.mutate(proposalId);
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  return (
    <>
      <YStack
        backgroundColor="$background"
        borderBottomWidth={1}
        borderBottomColor="$borderColor"
        padding="$3"
      >
        <XStack gap="$2" alignItems="center">
          <Input
            flex={1}
            placeholder="What do you want to schedule?"
            value={text}
            onChangeText={setText}
            onSubmitEditing={handleSubmit}
            returnKeyType="send"
            autoCapitalize="sentences"
          />
          <Button
            size="$4"
            circular
            theme="blue"
            icon={proposeMutation.isPending ? <Spinner /> : Send}
            onPress={handleSubmit}
            disabled={!text.trim() || proposeMutation.isPending}
          />
        </XStack>

        {proposeMutation.isError && (
          <Text color="$red10" fontSize="$2" marginTop="$2">
            Failed to get suggestions. Please try again.
          </Text>
        )}
      </YStack>

      {/* Proposals Sheet */}
      <Sheet
        modal
        open={showProposals}
        onOpenChange={setShowProposals}
        snapPoints={[85]}
        dismissOnSnapToBottom
      >
        <Sheet.Overlay />
        <Sheet.Frame padding="$4">
          <Sheet.Handle />

          <YStack gap="$4" marginTop="$2">
            {/* Intent Summary */}
            {intent && (
              <Card padding="$3" backgroundColor="$blue2">
                <YStack gap="$1">
                  <Text fontWeight="bold" color="$blue10">
                    {intent.title}
                  </Text>
                  <XStack gap="$2">
                    <Text color="$blue10" fontSize="$2">
                      {intent.type} • {intent.durationMinutes} min
                    </Text>
                    {intent.locationText && (
                      <Text color="$blue10" fontSize="$2">
                        • 📍 {intent.locationText}
                      </Text>
                    )}
                  </XStack>
                </YStack>
              </Card>
            )}

            {/* Warnings */}
            {warnings.length > 0 && (
              <Card padding="$3" backgroundColor="$yellow2">
                <XStack gap="$2" alignItems="center">
                  <AlertTriangle size={16} color="$yellow10" />
                  <Text color="$yellow10" fontSize="$2">
                    {warnings.join(' • ')}
                  </Text>
                </XStack>
              </Card>
            )}

            {/* Proposals */}
            <Text fontSize="$5" fontWeight="bold">
              Choose a time slot
            </Text>

            {proposals.length === 0 ? (
              <Card padding="$4">
                <Text color="$gray11" textAlign="center">
                  No available slots found. Try a different time or date.
                </Text>
              </Card>
            ) : (
              <YStack gap="$3">
                {proposals.map((proposal) => (
                  <Card
                    key={proposal.id}
                    padding="$4"
                    pressStyle={{ scale: 0.98 }}
                    borderWidth={proposal.rank === 1 ? 2 : 0}
                    borderColor="$blue10"
                  >
                    <YStack gap="$2">
                      <XStack justifyContent="space-between" alignItems="center">
                        <XStack gap="$2" alignItems="center">
                          {proposal.rank === 1 && (
                            <Text
                              fontSize="$2"
                              backgroundColor="$blue5"
                              paddingHorizontal="$2"
                              paddingVertical="$1"
                              borderRadius="$2"
                              color="$blue10"
                            >
                              Recommended
                            </Text>
                          )}
                          <Text color="$gray10" fontSize="$2">
                            {Math.round(proposal.confidence * 100)}% confidence
                          </Text>
                        </XStack>
                      </XStack>

                      <XStack gap="$2" alignItems="center">
                        <Clock size={16} color="$gray10" />
                        <Text fontWeight="bold">
                          {formatDate(proposal.startAt)}
                        </Text>
                        <Text>
                          {formatTime(proposal.startAt)} - {formatTime(proposal.endAt)}
                        </Text>
                      </XStack>

                      {proposal.travelDepartTime && (
                        <XStack gap="$2" alignItems="center">
                          <MapPin size={16} color="$blue10" />
                          <Text color="$blue10" fontSize="$3">
                            Leave by {formatTime(proposal.travelDepartTime)}
                            {proposal.travelEtaMinutes &&
                              ` (${proposal.travelEtaMinutes} min ${proposal.travelMode})`}
                          </Text>
                        </XStack>
                      )}

                      {proposal.weatherWarning && (
                        <XStack gap="$2" alignItems="center">
                          <AlertTriangle size={14} color="$orange10" />
                          <Text color="$orange10" fontSize="$2">
                            {proposal.weatherWarning}
                          </Text>
                        </XStack>
                      )}

                      {proposal.explanation.length > 0 && (
                        <Text color="$gray10" fontSize="$2">
                          {proposal.explanation.join(' • ')}
                        </Text>
                      )}

                      <Button
                        size="$3"
                        theme="blue"
                        marginTop="$2"
                        icon={commitMutation.isPending ? <Spinner /> : Check}
                        onPress={() => handleAccept(proposal.id)}
                        disabled={commitMutation.isPending}
                      >
                        Accept
                      </Button>
                    </YStack>
                  </Card>
                ))}
              </YStack>
            )}

            <Button
              size="$4"
              chromeless
              icon={X}
              onPress={() => setShowProposals(false)}
            >
              Cancel
            </Button>
          </YStack>
        </Sheet.Frame>
      </Sheet>
    </>
  );
}
