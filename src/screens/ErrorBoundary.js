import React from 'react';
import { View, Text } from 'react-native';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  componentDidCatch(error, info) {
    console.log('ERROR:', error);
    console.log('STACK:', info);

    this.setState({ hasError: true, error });
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={{ padding: 20 }}>
          <Text>Something went wrong</Text>
          <Text>{String(this.state.error)}</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;