import React, { useState, useEffect, useRef } from 'react';
import { View, StyleSheet, SafeAreaView, ActivityIndicator, Text } from 'react-native';
import MessageList from './MessageList';
import ChatInput from './ChatInput';
import Agent from '../../ai/Agent';

export default function AIChatScreen() {
  const [messages, setMessages] = useState([]);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const agentRef = useRef(null);

  useEffect(() => {
    const initAgent = async () => {
      try {
        agentRef.current = new Agent();
        await agentRef.current.initialize();
        setMessages([{ 
          role: 'assistant', 
          content: 'Hi! I am your Offline Financial AI Assistant. How can I help you today?' 
        }]);
      } catch (error) {
        setMessages([{ 
          role: 'assistant', 
          content: 'Failed to initialize AI. Please try again later.' 
        }]);
      } finally {
        setIsInitializing(false);
      }
    };

    initAgent();
  }, []);

  const handleSend = async (text) => {
    // Add user message to UI
    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setIsGenerating(true);

    try {
      // Send to Agent
      const responseText = await agentRef.current.sendMessage(text);
      
      // Add agent response to UI
      setMessages(prev => [...prev, { role: 'assistant', content: responseText }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, an error occurred.' }]);
    } finally {
      setIsGenerating(false);
    }
  };

  if (isInitializing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Initializing AI...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
    backgroundColor: '#F2F2F7'
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666'
  },
  typingIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    alignItems: 'flex-start'
  },
  typingText: {
    fontSize: 12,
    color: '#8E8E93',
    fontStyle: 'italic'
  }
});
