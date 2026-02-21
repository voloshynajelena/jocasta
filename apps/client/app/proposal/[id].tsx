import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useMemo } from 'react';

import { useAuthStore } from '../../src/store/authStore';
import { generateDemoProposals, Proposal, DEMO_WEATHER } from '../../src/data/demoData';

export default function ProposalScreen() {
  const { id, title: taskTitle } = useLocalSearchParams();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isDemoMode = user?.id === 'demo-user';

  const [loading, setLoading] = useState(false);
  const [selectedProposal, setSelectedProposal] = useState<string>('prop-1');
  const [transportMode, setTransportMode] = useState<'sedan' | 'transit'>('sedan');

  // Generate demo proposals
  const proposals = useMemo(() => generateDemoProposals(taskTitle as string || 'New Event'), [taskTitle]);

  const handleConfirm = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
      router.replace('/(tabs)');
    }, 1500);
  };

  const selected = proposals.find(p => p.id === selectedProposal) || proposals[0];

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
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backText}>Cancel</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Proposals</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Task Info */}
      <View style={styles.taskInfo}>
        <Text style={styles.taskLabel}>Scheduling</Text>
        <Text style={styles.taskTitle}>{taskTitle || 'New Event'}</Text>
      </View>

      {/* Weather Alert */}
      {DEMO_WEATHER.alerts.length > 0 && (
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

        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelText}>Cancel</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.bottomPadding} />
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
});
