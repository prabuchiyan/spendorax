import React from 'react';
import { View, Text, StyleSheet, FlatList } from 'react-native';

const MessageList = ({ messages }) => {
  const renderItem = ({ item }) => {
    // Only display user and assistant messages in the UI
    if (item.role !== 'user' && item.role !== 'assistant') return null;

    const isUser = item.role === 'user';
    return (
      <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.assistantBubble]}>
        <Text style={[styles.messageText, isUser ? styles.userText : styles.assistantText]}>
          {item.content}
        </Text>
      </View>
    );
  };

  return (
    <FlatList
      data={messages}
      renderItem={renderItem}
      keyExtractor={(_, index) => index.toString()}
      contentContainerStyle={styles.listContainer}
      inverted={false} // Might want to invert if chat starts from bottom
    />
  );
};

const styles = StyleSheet.create({
  listContainer: {
    padding: 16,
    paddingBottom: 24
  },
  messageBubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    marginVertical: 4
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#007AFF',
    borderBottomRightRadius: 4
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#E5E5EA',
    borderBottomLeftRadius: 4
  },
  messageText: {
    fontSize: 16
  },
  userText: {
    color: '#FFF'
  },
  assistantText: {
    color: '#000'
  }
});

export default MessageList;
