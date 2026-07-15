import React, { useEffect, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Text, View, Image, BackHandler } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ErrorBoundary from './src/screens/ErrorBoundary';
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
import LoanListScreen from './src/screens/LoanListScreen';
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
            <Stack.Screen name="LoanList" component={LoanListScreen} options={{ title: 'All Loans' }} />
            <Stack.Screen name="LoanHistory" component={require('./src/screens/LoanHistoryScreen').default} options={{ title: 'Loan History' }} />
            <Stack.Screen name="LoanReports" component={require('./src/screens/LoanReportsScreen').default} options={{ title: 'Loan Reports' }} />
          </Stack.Navigator>
        </NavigationContainer>
        <ExitConfirmationModal
          visible={visible}
          onCancel={hideDialog}
          onExit={() => BackHandler.exitApp()}
        />
      </PaperProvider>
    </ErrorBoundary>
  );
}