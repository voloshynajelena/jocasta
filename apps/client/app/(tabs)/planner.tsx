import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator } from 'react-native';
import { useState, useRef } from 'react';
import { useRouter } from 'expo-router';

import { useAuthStore } from '../../src/store/authStore';
import { useThemeStore } from '../../src/store/themeStore';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001';

const getAccessToken = (): string | null => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage.getItem('accessToken');
  }
  return null;
};

const EXAMPLE_INPUTS = [
  "Schedule vet appointment for Max this week",
  "Coffee with Sarah tomorrow afternoon",
  "Dentist checkup next Monday morning",
];

const BATCH_EXAMPLES = [
  "Meeting notes, email threads",
  "Weekly schedules",
  "Chat messages with plans",
];

type Mode = 'single' | 'batch';

export default function PlannerScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { colors } = useThemeStore();

  const [mode, setMode] = useState<Mode>('batch');
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleSingleSubmit = () => {
    if (!inputText.trim()) return;

    setIsProcessing(true);

    setTimeout(() => {
      setIsProcessing(false);
      router.push({
        pathname: '/proposal/[id]',
        params: { id: 'new', title: inputText.trim() },
      });
      setInputText('');
    }, 1000);
  };

  const handleBatchSubmit = async () => {
    if (!inputText.trim() || inputText.length < 20) return;

    setIsProcessing(true);

    try {
      const token = getAccessToken();
      const response = await fetch(`${API_URL}/api/v1/planner/batch/propose`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ text: inputText.trim() }),
      });

      if (!response.ok) {
        throw new Error('Failed to analyze text');
      }

      const data = await response.json();

      router.push(`/batch-review/${data.sessionId}` as any);
      setInputText('');
    } catch (error) {
      console.error('Batch propose error:', error);
      alert('Failed to analyze text. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSubmit = () => {
    if (mode === 'single') {
      handleSingleSubmit();
    } else {
      handleBatchSubmit();
    }
  };

  const handleExampleClick = (example: string) => {
    setInputText(example);
    inputRef.current?.focus();
  };

  if (!isAuthenticated) {
    return (
      <View style={styles.container}>
        <View style={styles.authPrompt}>
          <Text style={styles.authTitle}>Planning</Text>
          <Text style={styles.authSubtitle}>Sign in to use the AI planner</Text>
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

  const minLength = mode === 'batch' ? 20 : 1;
  const canSubmit = inputText.trim().length >= minLength && !isProcessing;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>Planning</Text>
          <Text style={[styles.headerSubtitle, { color: colors.textMuted }]}>
            {mode === 'batch'
              ? 'Paste meeting notes or schedules to extract events'
              : 'Tell me what you need to schedule'}
          </Text>
        </View>

        {/* Mode Toggle */}
        <View style={styles.modeToggleContainer}>
          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === 'batch' && styles.modeButtonActive,
            ]}
            onPress={() => setMode('batch')}
          >
            <Text style={styles.modeIcon}>📋</Text>
            <Text style={[styles.modeText, mode === 'batch' && styles.modeTextActive]}>
              Batch Plan
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.modeButton,
              mode === 'single' && styles.modeButtonActive,
            ]}
            onPress={() => setMode('single')}
          >
            <Text style={styles.modeIcon}>✨</Text>
            <Text style={[styles.modeText, mode === 'single' && styles.modeTextActive]}>
              Single Event
            </Text>
          </TouchableOpacity>
        </View>

        {/* Input Area */}
        <View style={styles.inputSection}>
          {mode === 'batch' ? (
            // Batch Input - Large Text Area
            <View style={styles.batchInputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.batchTextInput}
                placeholder="Paste your meeting notes, schedules, or plans here...&#10;&#10;Example:&#10;Monday 10am - Team standup&#10;Tuesday 2pm - Call with John Smith (john@email.com)&#10;Wednesday - Dentist appointment at Downtown Clinic"
                placeholderTextColor="#666"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={10000}
                textAlignVertical="top"
              />
              <View style={styles.inputFooter}>
                <Text style={styles.charCount}>
                  {inputText.length}/10000
                </Text>
              </View>
            </View>
          ) : (
            // Single Event Input
            <View style={styles.singleInputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.singleTextInput}
                placeholder="Schedule a vet appointment for Max..."
                placeholderTextColor="#666"
                value={inputText}
                onChangeText={setInputText}
                multiline
                maxLength={500}
                onSubmitEditing={handleSubmit}
              />
              <TouchableOpacity
                style={[styles.submitButtonSmall, !canSubmit && styles.submitButtonDisabled]}
                onPress={handleSubmit}
                disabled={!canSubmit}
              >
                {isProcessing ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.submitIcon}>✨</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Submit Button for Batch Mode */}
          {mode === 'batch' && (
            <TouchableOpacity
              style={[styles.analyzeButton, !canSubmit && styles.analyzeButtonDisabled]}
              onPress={handleSubmit}
              disabled={!canSubmit}
            >
              {isProcessing ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Text style={styles.analyzeButtonIcon}>🔍</Text>
                  <Text style={styles.analyzeButtonText}>Analyze & Extract Events</Text>
                </>
              )}
            </TouchableOpacity>
          )}

          {/* Example Suggestions */}
          <View style={styles.examplesSection}>
            <Text style={styles.examplesLabel}>
              {mode === 'batch' ? 'Works great with:' : 'Try saying:'}
            </Text>
            <View style={styles.examplesGrid}>
              {(mode === 'batch' ? BATCH_EXAMPLES : EXAMPLE_INPUTS).map((example, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.exampleChip}
                  onPress={() => mode === 'single' && handleExampleClick(example)}
                >
                  <Text style={styles.exampleText}>{example}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* What Gets Extracted (Batch Mode) */}
        {mode === 'batch' && (
          <View style={styles.extractionSection}>
            <Text style={styles.sectionTitle}>What gets extracted</Text>
            <View style={styles.extractionGrid}>
              <View style={styles.extractionCard}>
                <Text style={styles.extractionIcon}>📅</Text>
                <Text style={styles.extractionTitle}>Events</Text>
                <Text style={styles.extractionDesc}>Meetings, appointments, and scheduled activities</Text>
              </View>
              <View style={styles.extractionCard}>
                <Text style={styles.extractionIcon}>👥</Text>
                <Text style={styles.extractionTitle}>Contacts</Text>
                <Text style={styles.extractionDesc}>Names, emails, and phone numbers</Text>
              </View>
              <View style={styles.extractionCard}>
                <Text style={styles.extractionIcon}>📍</Text>
                <Text style={styles.extractionTitle}>Locations</Text>
                <Text style={styles.extractionDesc}>Places and addresses mentioned</Text>
              </View>
              <View style={styles.extractionCard}>
                <Text style={styles.extractionIcon}>⏰</Text>
                <Text style={styles.extractionTitle}>Times</Text>
                <Text style={styles.extractionDesc}>Dates, times, and durations</Text>
              </View>
            </View>
          </View>
        )}

        {/* How it Works */}
        <View style={styles.stepsSection}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <View style={styles.stepsContainer}>
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>
                  {mode === 'batch' ? 'Paste your text' : 'Describe your event'}
                </Text>
                <Text style={styles.stepDesc}>
                  {mode === 'batch'
                    ? 'Paste meeting notes, email threads, or schedules'
                    : 'Type what you want to schedule in plain language'}
                </Text>
              </View>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>
                  {mode === 'batch' ? 'Review extracted items' : 'AI finds options'}
                </Text>
                <Text style={styles.stepDesc}>
                  {mode === 'batch'
                    ? 'Confirm contacts and select time slots for each event'
                    : 'Get 3-5 ranked time slots with travel info'}
                </Text>
              </View>
            </View>
            <View style={styles.stepConnector} />
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <View style={styles.stepContent}>
                <Text style={styles.stepTitle}>Confirm & done</Text>
                <Text style={styles.stepDesc}>
                  {mode === 'batch'
                    ? 'All events sync to your calendar at once'
                    : 'Pick a slot and it syncs to your calendar'}
                </Text>
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
    paddingBottom: 16,
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
  modeToggleContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 10,
    marginBottom: 16,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#2d2d44',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  modeButtonActive: {
    borderColor: '#3b82f6',
    backgroundColor: '#1e3a5f',
  },
  modeIcon: {
    fontSize: 18,
  },
  modeText: {
    color: '#888',
    fontSize: 15,
    fontWeight: '500',
  },
  modeTextActive: {
    color: '#fff',
  },
  inputSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  batchInputContainer: {
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    overflow: 'hidden',
  },
  batchTextInput: {
    color: '#fff',
    fontSize: 15,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 16,
    minHeight: 200,
    maxHeight: 300,
  },
  inputFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  charCount: {
    color: '#666',
    fontSize: 12,
  },
  singleInputContainer: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 16,
    padding: 4,
    alignItems: 'flex-end',
  },
  singleTextInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 56,
    maxHeight: 120,
  },
  submitButtonSmall: {
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
  analyzeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#3b82f6',
    paddingVertical: 16,
    borderRadius: 12,
    marginTop: 12,
  },
  analyzeButtonDisabled: {
    backgroundColor: '#3d3d5c',
  },
  analyzeButtonIcon: {
    fontSize: 18,
  },
  analyzeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
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
  extractionSection: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 14,
  },
  extractionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  extractionCard: {
    width: '48%',
    backgroundColor: '#2d2d44',
    borderRadius: 14,
    padding: 16,
  },
  extractionIcon: {
    fontSize: 24,
    marginBottom: 10,
  },
  extractionTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  extractionDesc: {
    color: '#888',
    fontSize: 12,
    lineHeight: 16,
  },
  stepsSection: {
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
