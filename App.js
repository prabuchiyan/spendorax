import React, { useEffect, useState, useRef } from 'react';
import { Text, View, Image, BackHandler, ToastAndroid } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ErrorBoundary from './src/screens/ErrorBoundary';
import TransactionAddScreen from './src/screens/TransactionAddScreen';
import SourcesDashboard from './src/screens/SourcesDashboard';
import SpendAreasDashboard from './src/screens/SpendAreasDashboard';
import SourcesDetails from './src/screens/SourcesDetails';
import CategoriesDetails from './src/screens/CategoriesDetails';
import ReportsScreen from './src/screens/ReportsScreen';
import BillsScreen from './src/screens/BillsScreen';
import BillDetailScreen from './src/screens/BillDetailScreen';
import BackupScreen from './src/screens/BackupScreen';
import DrawerNavigator from './navigation/DrawerNavigator';
import { initDB } from './src/database/init';
import { runBillMaintenance } from './src/services/bills';
import { Provider as PaperProvider, DefaultTheme as PaperDefaultTheme } from 'react-native-paper';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { Colors } from './src/components/Theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const backPressCount = useRef(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (MaterialCommunityIcons?.loadFont) {
          await MaterialCommunityIcons.loadFont();
        }
        if (Feather?.loadFont) {
          await Feather.loadFont();
        }

        await initDB();

        try {
          await runBillMaintenance();
        } catch (e) {
          console.warn('Bill maintenance error', e);
        }

        setReady(true);

      } catch (e) {
        console.error('App init failed:', e);
      }
    })();
  }, []);

  useEffect(() => {
    const onBackPress = () => {
      const route = navigationRef.getCurrentRoute();
      if (route?.name !== 'Drawer') {
        return false;
      }
      if (backPressCount.current === 0) {
        backPressCount.current += 1;
        ToastAndroid.show('Press back again to exit', ToastAndroid.SHORT);
        setTimeout(() => {
          backPressCount.current = 0;
        }, 2000);
        return true;
      }
      BackHandler.exitApp();
      return true;
    };
    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => subscription.remove();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Image
          source={require('./assets/logo.png')}
          style={{ width: 100, height: 100, marginBottom: 20 }}
          resizeMode="contain"
        />
        <Text>Prabuchiyan...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <PaperProvider
        theme={{
          ...PaperDefaultTheme,
          colors: {
            ...PaperDefaultTheme.colors,
            primary: Colors.primary,
            accent: Colors.accent
          }
        }}
      >
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator>
            <Stack.Screen
              name="Drawer"
              component={DrawerNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen name="TransactionAdd" component={TransactionAddScreen} options={{ title: 'Add Transaction' }} />
            <Stack.Screen name="SourcesDashboard" component={SourcesDashboard} />
            <Stack.Screen name="SourcesDetails" component={SourcesDetails} />
            <Stack.Screen name="SpendAreasDashboard" component={SpendAreasDashboard} />
            <Stack.Screen name="CategoriesDetails" component={CategoriesDetails} />
            <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Financial Reports' }} />
            <Stack.Screen name="Bills" component={BillsScreen} options={{ title: 'Bills' }} />
            <Stack.Screen name="BillDetail" component={BillDetailScreen} options={{ title: 'Bill Details' }} />
            <Stack.Screen name="Backup" component={BackupScreen} options={{ title: 'Backup & Restore' }} />
          </Stack.Navigator>
        </NavigationContainer>
      </PaperProvider>
    </ErrorBoundary>
  );
}