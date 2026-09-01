import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, View, Image, BackHandler } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ErrorBoundary from './src/screens/ErrorBoundary';
import { BalanceVisibilityProvider } from './src/context/BalanceVisibilityContext';
import { PageLoaderProvider } from './src/context/PageLoaderContext';
import {
  requestPermission,
  rescheduleAll,
  registerNotificationListener,
} from './src/services/notificationService';
import SearchScreen from './src/screens/SearchScreen';
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
import LoanFormScreen from './src/screens/LoanFormScreen';
import LoanDetailsScreen from './src/screens/LoanDetailsScreen';
import LoanPaymentScreen from './src/screens/LoanPaymentScreen';
import LoanForeclosureScreen from './src/screens/LoanForeclosureScreen';
import LendMoreScreen from './src/screens/LendMoreScreen';
import TopUpScreen from './src/screens/TopUpScreen';
import LoanListScreen from './src/screens/LoanListScreen';
import CreditCardStatementsScreen from './src/screens/CreditCardStatementsScreen';
import { initDB } from './src/database/init';
import ExitConfirmationModal from './src/components/ExitConfirmationModal';
import useExitConfirmation from './src/hooks/useExitConfirmation';
import { runBillMaintenance } from './src/services/bills';
import { Provider as PaperProvider, DefaultTheme as PaperDefaultTheme } from 'react-native-paper';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { Colors } from './src/components/Theme';

const Stack = createNativeStackNavigator();

export default function App() {
  const navigationRef = useNavigationContainerRef();
  const [ready, setReady] = useState(false);
  const { visible, hideDialog } = useExitConfirmation({ navigationRef, rootRouteNames: ['Dashboard'] });

  useEffect(() => {
    let unsubNotification = null;

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

        try {
          await requestPermission();
          await rescheduleAll(); // already cancels all before rescheduling
        } catch (e) {
          console.warn('Notification init error', e);
        }

        setReady(true);

        // Register OUTSIDE the async IIFE return so React gets the cleanup
        unsubNotification = registerNotificationListener(navigationRef);

      } catch (e) {
        console.error('App init failed:', e);
      }
    })();

    // This cleanup now actually runs when component unmounts
    return () => {
      if (unsubNotification) unsubNotification();
    };
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
        <StatusBar
          style="light"
          backgroundColor="#0B1F3A"
        />
        <PageLoaderProvider>
          <BalanceVisibilityProvider>
            <NavigationContainer ref={navigationRef}>
            <Stack.Navigator>
              <Stack.Screen
                name="Drawer"
                component={DrawerNavigator}
                options={{ headerShown: false }}
              />
              <Stack.Screen name="Search" component={SearchScreen} />
              <Stack.Screen name="TransactionAdd" component={TransactionAddScreen} options={{ title: 'Add Transaction' }} />
              <Stack.Screen name="SourcesDashboard" component={SourcesDashboard} />
              <Stack.Screen name="SourcesDetails" component={SourcesDetails} />
              <Stack.Screen name="SpendAreasDashboard" component={SpendAreasDashboard} />
              <Stack.Screen name="CategoriesDetails" component={CategoriesDetails} />
              <Stack.Screen name="Reports" component={ReportsScreen} options={{ title: 'Financial Reports' }} />
              <Stack.Screen name="Bills" component={BillsScreen} options={{ title: 'Bills' }} />
              <Stack.Screen name="BillDetail" component={BillDetailScreen} options={{ title: 'Bill Details' }} />
              <Stack.Screen name="Backup" component={BackupScreen} options={{ title: 'Backup & Restore' }} />
              <Stack.Screen name="LoanForm" component={LoanFormScreen} options={{ title: 'Add / Edit Loan' }} />
              <Stack.Screen name="LoanDetails" component={LoanDetailsScreen} options={{ title: 'Loan Details' }} />
              <Stack.Screen name="LoanPayment" component={LoanPaymentScreen} options={{ title: 'Record Payment' }} />
              <Stack.Screen name="LoanForeclose" component={LoanForeclosureScreen} options={{ title: 'Loan Foreclose' }} />
              <Stack.Screen name="LendMore" component={LendMoreScreen} options={{ title: 'Lend More' }} />
              <Stack.Screen name="TopUp" component={TopUpScreen} options={{ title: 'Top Up' }} />
              <Stack.Screen name="LoanList" component={LoanListScreen} options={{ title: 'All Loans' }} />
              <Stack.Screen name="CreditCardStatements" component={CreditCardStatementsScreen} options={{ title: 'Credit Card Statements' }} />
              <Stack.Screen name="LoanHistory" component={require('./src/screens/LoanHistoryScreen').default} options={{ title: 'Loan History' }} />
              <Stack.Screen name="LoanReports" component={require('./src/screens/LoanReportsScreen').default} options={{ title: 'Loan Reports' }} />
              <Stack.Screen name="NotificationSettings" component={require('./src/screens/NotificationSettingsScreen').default} options={{ title: 'Notifications' }} />
            </Stack.Navigator>
          </NavigationContainer>
          </BalanceVisibilityProvider>
        </PageLoaderProvider>
        <ExitConfirmationModal
          visible={visible}
          onCancel={hideDialog}
          onExit={() => BackHandler.exitApp()}
        />
      </PaperProvider>
    </ErrorBoundary>
  );
}