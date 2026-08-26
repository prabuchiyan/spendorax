import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, SafeAreaView, ActivityIndicator, Text } from 'react-native';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import Agent from '../../ai/Agent';

function getWelcomeMessage(runtimeInfo) {
  if (runtimeInfo?.mode === 'web-llm') {
    return 'Hi! I am your Offline Financial AI Assistant. How can I help you today?';
  }

  if (runtimeInfo?.mode === 'mock') {
    return 'Hi! I am your Financial Assistant (rule-based mode). I can answer spending, budget, bill, and loan questions using your local data. For full on-device AI, open SpendoraX in Chrome/Edge on desktop.';
  }

  return 'Hi! I am your Financial AI Assistant. How can I help you today?';
}

export default function AIChatScreen() {
  const [messages, setMessages] = useState([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initProgress, setInitProgress] = useState('Starting engine...');
  const [isGenerating, setIsGenerating] = useState(false);
  const [runtimeLabel, setRuntimeLabel] = useState(null);
  const agentRef = useRef(null);

  useEffect(() => {
    const initAgent = async () => {
      try {
        agentRef.current = new Agent();
        await agentRef.current.initialize((progressInfo) => {
          setInitProgress(progressInfo?.text || 'Loading...');
        });

        const runtimeInfo = agentRef.current.getRuntimeInfo();
        setRuntimeLabel(runtimeInfo?.label || null);
        setMessages([
          {
            role: 'assistant',
            content: getWelcomeMessage(runtimeInfo),
          },
        ]);
      } catch (error) {
        console.error('AI initialization failed:', error);
        setMessages([
          {
            role: 'assistant',
            content: `Failed to initialize AI: ${error?.message || 'Unknown error'}. Your normal financial features continue to work.`,
          },
        ]);
      } finally {
        setIsInitializing(false);
      }
    };

    initAgent();
  }, []);

  const handleSend = async (text) => {
    if (!agentRef.current?.llm) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'AI is not ready yet. Please reopen this screen.' },
      ]);
      return;
    }

    const userMessage = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMessage]);
    setIsGenerating(true);

    try {
      const responseText = await agentRef.current.sendMessage(text);
      setMessages((prev) => [...prev, { role: 'assistant', content: responseText }]);
    } catch (error) {
      console.error('AI sendMessage failed:', error);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: 'Sorry, an error occurred while processing your request.' },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing AI...</Text>
        <Text style={styles.progressText}>{initProgress}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {runtimeLabel ? (
        <View style={styles.runtimeBanner}>
          <Text style={styles.runtimeText}>{runtimeLabel}</Text>
        </View>
      ) : null}
      <MessageList messages={messages} />
      {isGenerating && (
        <View style={styles.typingIndicator}>
          <Text style={styles.typingText}>Agent is thinking...</Text>
        </View>
      )}
      <ChatInput onSend={handleSend} disabled={isGenerating} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F2F2F7',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  progressText: {
    marginTop: 8,
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  runtimeBanner: {
    backgroundColor: '#E8F1FF',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#C7D7F5',
  },
  runtimeText: {
    fontSize: 12,
    color: '#245CA8',
    textAlign: 'center',
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-start',
  },
  typingText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic',
  },
});
