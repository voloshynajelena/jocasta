import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useState, useRef } from 'react';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../src/store/authStore';
import { useThemeStore } from '../../src/store/themeStore';
import { DEMO_TASKS, Task } from '../../src/data/demoData';

const EXAMPLE_INPUTS = [
  "Schedule vet appointment for Max this week",
  "Coffee with Sarah tomorrow afternoon",
  "Dentist checkup next Monday morning",
  "Grocery run after kids pickup",
  "Date night on Saturday, need babysitter",
];

export default function PlannerScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isDemoMode = user?.id === 'demo-user';
  const { colors } = useThemeStore();

  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSubmit = () => {
    if (!inputText.trim()) return;

    setIsProcessing(true);

    // Simulate AI processing
    setTimeout(() => {
      setIsProcessing(false);
      router.push({
        pathname: '/proposal/[id]',
        params: { id: 'new', title: inputText.trim() },
      });
      setInputText('');
    }, 1000);
  };

  const handleExampleClick = (example: string) => {
    setInputText(example);
    inputRef.current?.focus();
  };

  const handleTaskSchedule = (task: Task) => {
    router.push({
      pathname: '/proposal/[id]',
      params: { id: task.id, title: task.title },
    });
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.authPrompt}>
          <Text style={styles.authTitle}>AI Planner</Text>
          <Text style={styles.authSubtitle}>Sign in to use the AI scheduler</Text>
          <TouchableOpacity
            style={styles.signInButton}
            onPress={() => router.push('/(auth)/login')}
          >
            <Text style={styles.signInText}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const pendingTasks = DEMO_TASKS.filter(t => t.status === 'pending');

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>AI Planner</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>Tell me what you need to schedule</Text>
        </View>

        {/* Input Area */}
        <View style={styles.inputSection}>
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.textInput}
              placeholder="Schedule a vet appointment for Max..."
              placeholderTextColor="#666"
              value={inputText}
              onChangeText={setInputText}
              multiline
              maxLength={500}
              onSubmitEditing={handleSubmit}
            />
            <TouchableOpacity
              style={[styles.submitButton, !inputText.trim() && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={!inputText.trim() || isProcessing}
            >
              {isProcessing ? (
                <Text style={styles.submitIcon}>⏳</Text>
              ) : (
                <Text style={styles.submitIcon}>✨</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Example Suggestions */}
          <View style={styles.examplesSection}>
            <Text style={styles.examplesLabel}>Try saying:</Text>
            <View style={styles.examplesGrid}>
              {EXAMPLE_INPUTS.map((example, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.exampleChip}
                  onPress={() => handleExampleClick(example)}
                >
                  <Text style={styles.exampleText} numberOfLines={1}>{example}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* AI Capabilities */}
        <View style={styles.capabilitiesSection}>
          <Text style={styles.sectionTitle}>What I can do</Text>
          <View style={styles.capabilitiesGrid}>
            <View style={styles.capabilityCard}>
              <Text style={styles.capabilityIcon}>📅</Text>
              <Text style={styles.capabilityTitle}>Smart Scheduling</Text>
              <Text style={styles.capabilityDesc}>Find optimal time slots based on your calendar</Text>
            </View>
            <View style={styles.capabilityCard}>
              <Text style={styles.capabilityIcon}>🚗</Text>
              <Text style={styles.capabilityTitle}>Travel Time</Text>
              <Text style={styles.capabilityDesc}>Calculate travel between locations</Text>
            </View>
            <View style={styles.capabilityCard}>
              <Text style={styles.capabilityIcon}>❄️</Text>
              <Text style={styles.capabilityTitle}>Weather Impact</Text>
              <Text style={styles.capabilityDesc}>Adjust ETAs for Calgary weather</Text>
            </View>
            <View style={styles.capabilityCard}>
              <Text style={styles.capabilityIcon}>🔒</Text>
              <Text style={styles.capabilityTitle}>Respect Constraints</Text>
              <Text style={styles.capabilityDesc}>Honor your locked events and rules</Text>
            </View>
          </View>
        </View>

        {/* Pending Tasks */}
        {pendingTasks.length > 0 && (
          <View style={styles.tasksSection}>
            <Text style={styles.sectionTitle}>Tasks to Schedule</Text>
            <Text style={styles.sectionSubtitle}>{pendingTasks.length} pending</Text>

            {pendingTasks.slice(0, 5).map(task => (
              <TouchableOpacity
                key={task.id}
                style={styles.taskCard}
                onPress={() => handleTaskSchedule(task)}
              >
                <View style={styles.taskInfo}>
                  <View style={styles.taskHeader}>
                    <Text style={styles.taskTitle}>{task.title}</Text>
                    {task.priority === 3 && (
                      <Text style={styles.urgentBadge}>!</Text>
                    )}
                  </View>
                  <View style={styles.taskMeta}>
                    <Text style={styles.taskDuration}>{task.durationMinutes}m</Text>
                    {task.deadlineAt && (
                      <Text style={styles.taskDeadline}>
                        Due {new Date(task.deadlineAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </Text>
                    )}
                  </View>
                </View>
                <View style={styles.scheduleButton}>
                  <Text style={styles.scheduleIcon}>→</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Recent Proposals */}
        <View style={styles.recentSection}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <View style={styles.stepsContainer}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Describe your event</Text>
                <Text style={styles.stepDesc}>Type what you want to schedule in plain language</Text>
              </View>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>AI finds options</Text>
                <Text style={styles.stepDesc}>Get 3-5 ranked time slots with travel info</Text>
              </View>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Confirm & done</Text>
                <Text style={styles.stepDesc}>Pick a slot and it syncs to your calendar</Text>
              </View>
            </View>
          </View>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollView: {
    flex: 1,
  },
  authPrompt: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  authTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  authSubtitle: {
    fontSize: 16,
    color: '#888',
    marginBottom: 32,
  },
  signInButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  signInText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#888',
  },
  inputSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  inputContainer: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    padding: 4,
    alignItems: 'flex-end',
  },
  textInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
    maxHeight: 120,
  },
  submitButton: {
    backgroundColor: '#3b82f6',
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  submitButtonDisabled: {
    backgroundColor: '#3d3d5c',
  },
  submitIcon: {
    fontSize: 20,
  },
  examplesSection: {
    marginTop: 16,
  },
  examplesLabel: {
    color: '#888',
    fontSize: 13,
    marginBottom: 10,
  },
  examplesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  exampleChip: {
    backgroundColor: '#2d2d44',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#3d3d5c',
  },
  exampleText: {
    color: '#ccc',
    fontSize: 13,
  },
  capabilitiesSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 14,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
    marginTop: -10,
    marginBottom: 14,
  },
  capabilitiesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  capabilityCard: {
    width: '48%',
    backgroundColor: '#2d2d44',
    borderRadius: 14,
    padding: 16,
  },
  capabilityIcon: {
    fontSize: 24,
    marginBottom: 10,
  },
  capabilityTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  capabilityDesc: {
    color: '#888',
    fontSize: 12,
    lineHeight: 16,
  },
  tasksSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  taskCard: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    alignItems: 'center',
  },
  taskInfo: {
    flex: 1,
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  taskTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  urgentBadge: {
    color: '#ef4444',
    fontSize: 14,
    fontWeight: 'bold',
    backgroundColor: '#7f1d1d',
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: 'center',
    lineHeight: 20,
  },
  taskMeta: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 6,
  },
  taskDuration: {
    color: '#888',
    fontSize: 13,
  },
  taskDeadline: {
    color: '#f59e0b',
    fontSize: 13,
  },
  scheduleButton: {
    backgroundColor: '#3b82f6',
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scheduleIcon: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  recentSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  stepsContainer: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    padding: 20,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  stepNumberText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 'bold',
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 2,
  },
  stepDesc: {
    color: '#888',
    fontSize: 13,
    lineHeight: 18,
  },
  stepConnector: {
    width: 2,
    height: 20,
    backgroundColor: '#3d3d5c',
    marginLeft: 15,
    marginVertical: 8,
  },
  bottomPadding: {
    height: 100,
  },
});
