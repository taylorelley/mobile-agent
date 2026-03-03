import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/ThemeContext';
import { updateSoul, updateSettings } from '../src/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

export default function OnboardingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [agentName, setAgentName] = useState('LobsterLite');
  const [personality, setPersonality] = useState('Friendly and helpful');

  const completeOnboarding = useCallback(async () => {
    try {
      const soulContent = `# Identity\n- Name: ${agentName}\n- Role: Personal AI assistant\n\n# Personality\n- Tone: ${personality}\n- Style: Direct and helpful\n\n# Rules\n- Always respect user privacy\n- Be honest about limitations\n- Never make up information\n\n# Knowledge\n- General purpose assistant\n`;
      await updateSoul(soulContent);
      await updateSettings({ onboarding_completed: true, agent_name: agentName });
      await AsyncStorage.setItem('onboarding_completed', 'true');
      router.replace('/(tabs)');
    } catch (e) {
      await AsyncStorage.setItem('onboarding_completed', 'true');
      router.replace('/(tabs)');
    }
  }, [agentName, personality, router]);

  const skipOnboarding = useCallback(async () => {
    await AsyncStorage.setItem('onboarding_completed', 'true');
    router.replace('/(tabs)');
  }, [router]);

  const steps = [
    // Step 0: Welcome
    <View key="welcome" style={styles.stepContent}>
      <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
        <MaterialCommunityIcons name="robot-excited-outline" size={64} color={colors.primary} />
      </View>
      <Text style={[styles.title, { color: colors.primary }]}>LobsterLite</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Your private, on-device AI agent
      </Text>
      <View style={[styles.featureCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <FeatureRow icon="message-text-outline" label="Chat Model" desc="Natural conversation powered by Qwen3 0.6B" colors={colors} />
        <FeatureRow icon="lightning-bolt" label="Action Model" desc="Device actions via FunctionGemma 270M" colors={colors} />
        <FeatureRow icon="shield-check-outline" label="Fully Private" desc="Zero network egress for inference" colors={colors} />
      </View>
    </View>,
    // Step 1: Personalize
    <View key="personalize" style={styles.stepContent}>
      <View style={[styles.iconCircle, { backgroundColor: colors.secondary + '15' }]}>
        <MaterialCommunityIcons name="account-edit-outline" size={48} color={colors.secondary} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Personalize</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        {"Configure your agent's identity"}
      </Text>
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Agent Name</Text>
        <TextInput
          testID="onboarding-agent-name"
          style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
          value={agentName}
          onChangeText={setAgentName}
          placeholder="e.g., LobsterLite, Max, Nova"
          placeholderTextColor={colors.textSecondary}
        />
      </View>
      <View style={styles.formGroup}>
        <Text style={[styles.label, { color: colors.textSecondary }]}>Personality</Text>
        <TextInput
          testID="onboarding-personality"
          style={[styles.formInput, { backgroundColor: colors.inputBg, color: colors.textPrimary, borderColor: colors.border }]}
          value={personality}
          onChangeText={setPersonality}
          placeholder="e.g., Sarcastic pirate, Professional, Friendly"
          placeholderTextColor={colors.textSecondary}
        />
      </View>
    </View>,
    // Step 2: Ready
    <View key="ready" style={styles.stepContent}>
      <View style={[styles.iconCircle, { backgroundColor: colors.success + '15' }]}>
        <MaterialCommunityIcons name="check-circle-outline" size={64} color={colors.success} />
      </View>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Ready</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Your agent is configured and ready to go
      </Text>
      <View style={[styles.modelStatusCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <ModelStatusRow name="Qwen3 0.6B" type="Chat Model" status="Available" colors={colors} />
        <ModelStatusRow name="FunctionGemma 270M" type="Action Model" status="Available" colors={colors} />
      </View>
      <Text style={[styles.readyHint, { color: colors.textSecondary }]}>
        Download models from the Model Manager for on-device inference
      </Text>
    </View>,
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <View style={styles.stepIndicators}>
          {[0, 1, 2].map((i) => (
            <View
              key={i}
              style={[styles.stepDot, { backgroundColor: i <= step ? colors.primary : colors.border }]}
            />
          ))}
        </View>
        <TouchableOpacity testID="onboarding-skip" onPress={skipOnboarding}>
          <Text style={[styles.skipText, { color: colors.textSecondary }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      {steps[step]}

      <View style={styles.bottomBar}>
        {step > 0 && (
          <TouchableOpacity
            testID="onboarding-back"
            style={[styles.backBtn, { borderColor: colors.border }]}
            onPress={() => setStep((s) => s - 1)}
          >
            <Text style={[styles.backBtnText, { color: colors.textPrimary }]}>Back</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          testID="onboarding-next"
          style={[styles.nextBtn, { backgroundColor: colors.primary }, step === 0 && { flex: 1 }]}
          onPress={() => {
            if (step < 2) setStep((s) => s + 1);
            else completeOnboarding();
          }}
        >
          <Text style={[styles.nextBtnText, { color: colors.primaryForeground }]}>
            {step === 2 ? 'Get Started' : 'Continue'}
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function FeatureRow({ icon, label, desc, colors }: any) {
  return (
    <View style={styles.featureRow}>
      <MaterialCommunityIcons name={icon} size={24} color={colors.primary} />
      <View style={styles.featureText}>
        <Text style={[styles.featureLabel, { color: colors.textPrimary }]}>{label}</Text>
        <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>{desc}</Text>
      </View>
    </View>
  );
}

function ModelStatusRow({ name, type, status, colors }: any) {
  return (
    <View style={styles.modelRow}>
      <MaterialCommunityIcons name="chip" size={20} color={colors.secondary} />
      <View style={{ flex: 1 }}>
        <Text style={[styles.modelName, { color: colors.textPrimary }]}>{name}</Text>
        <Text style={[styles.modelType, { color: colors.textSecondary }]}>{type}</Text>
      </View>
      <View style={[styles.modelBadge, { backgroundColor: colors.success + '20' }]}>
        <Text style={[styles.modelBadgeText, { color: colors.success }]}>{status}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingHorizontal: 24 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16 },
  stepIndicators: { flexDirection: 'row', gap: 6 },
  stepDot: { height: 4, flex: 1, maxWidth: 60, borderRadius: 2 },
  skipText: { fontSize: 14, fontWeight: '600' },
  stepContent: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  iconCircle: { width: 120, height: 120, borderRadius: 60, justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -1 },
  subtitle: { fontSize: 16, textAlign: 'center', marginTop: 8, lineHeight: 24 },
  featureCard: { width: '100%', borderRadius: 12, borderWidth: 1, padding: 16, marginTop: 32, gap: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureText: { flex: 1 },
  featureLabel: { fontSize: 15, fontWeight: '600' },
  featureDesc: { fontSize: 13, marginTop: 2 },
  formGroup: { width: '100%', marginTop: 20 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginBottom: 8, textTransform: 'uppercase' },
  formInput: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16 },
  modelStatusCard: { width: '100%', borderRadius: 12, borderWidth: 1, padding: 16, marginTop: 24, gap: 14 },
  modelRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  modelName: { fontSize: 14, fontWeight: '600' },
  modelType: { fontSize: 12, marginTop: 1 },
  modelBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  modelBadgeText: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  readyHint: { fontSize: 13, textAlign: 'center', marginTop: 16, lineHeight: 20 },
  bottomBar: { flexDirection: 'row', gap: 12, paddingBottom: 16 },
  backBtn: { flex: 1, paddingVertical: 16, borderRadius: 14, borderWidth: 1, alignItems: 'center' },
  backBtnText: { fontSize: 16, fontWeight: '600' },
  nextBtn: { flex: 2, paddingVertical: 16, borderRadius: 14, alignItems: 'center' },
  nextBtnText: { fontSize: 16, fontWeight: '700' },
});
