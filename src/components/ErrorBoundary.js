import React from 'react';
import { View, Text, ScrollView } from 'react-native';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScrollView style={{ flex: 1, padding: 20, backgroundColor: '#fdd' }}>
          <Text style={{ color: 'red', fontSize: 18, fontWeight: 'bold' }}>
            TransactionForm CRASHED:
          </Text>
          <Text style={{ color: 'black', marginTop: 10 }}>
            {String(this.state.error)}
          </Text>
          <Text style={{ color: 'black', marginTop: 10 }}>
            {this.state.error && this.state.error.stack}
          </Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}
