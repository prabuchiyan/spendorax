import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image } from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Import Screens
import HomeScreen from '../src/screens/HomeScreen';
import TransactionsScreen from '../src/screens/TransactionsScreen';
import BudgetsScreen from '../src/screens/BudgetsScreen';
import CategoriesScreen from '../src/screens/CategoriesScreen';
import SourcesScreen from '../src/screens/SourcesScreen';

import { Colors } from '../src/components/Theme';

const Drawer = createDrawerNavigator();

function CustomDrawerContent(props) {
  const insets = useSafeAreaInsets();
  const { state, navigation } = props;
  const activeRouteName = state.routeNames[state.index];

  const menuItems = [
    {
      name: 'Dashboard',
      label: 'Dashboard',
      icon: 'view-dashboard-outline',
      activeIcon: 'view-dashboard',
    },
    {
      name: 'Budgets',
      label: 'Budgets',
      icon: 'wallet-outline',
      activeIcon: 'wallet',
    },
    {
      name: 'Sources',
      label: 'Sources',
      icon: 'credit-card-outline',
      activeIcon: 'credit-card',
    },
    {
      name: 'Categories',
      label: 'Categories',
      icon: 'tag-multiple-outline',
      activeIcon: 'tag-multiple',
    },
    {
      name: 'Bills',
      label: 'Bills',
      icon: 'file-document-outline',
      activeIcon: 'file-document',
    },
    {
      name: 'Transactions',
      label: 'Transactions',
      icon: 'format-list-bulleted',
      activeIcon: 'format-list-bulleted',
    },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* Drawer Header */}
      <View style={[styles.headerContainer, { paddingTop: insets.top + 20 }]}>
        <View style={styles.avatarContainer}>
          <Image
            source={require('../assets/logo.png')}
            style={{ width: 56, height: 56, resizeMode: 'contain' }}
          />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={styles.appName}>SpendoraX</Text>
          <Text style={styles.appVersion}>v2.3</Text>
        </View>
      </View>

      <View style={styles.divider} />

      {/* Drawer Items */}
      <DrawerContentScrollView {...props} contentContainerStyle={styles.scrollContainer}>
        {menuItems.map((item) => {
          const isActive = activeRouteName === item.name;
          return (
            <TouchableOpacity
              key={item.name}
              activeOpacity={0.7}
              onPress={() => {
                navigation.navigate(item.name);
                navigation.closeDrawer();
              }}
              style={[
                styles.drawerItem,
                isActive && styles.drawerItemActive,
              ]}
            >
              <MaterialCommunityIcons
                name={isActive ? item.activeIcon : item.icon}
                size={22}
                color={isActive ? '#fff' : '#666'}
                style={styles.drawerIcon}
              />
              <Text
                style={[
                  styles.drawerLabel,
                  isActive && styles.drawerLabelActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </DrawerContentScrollView>

      {/* Footer / Backup Screen shortcut */}
      <View style={[styles.footerContainer, { paddingBottom: insets.bottom + 20 }]}>
        <TouchableOpacity
          style={styles.footerButton}
          onPress={() => {
            navigation.navigate('Backup');
            navigation.closeDrawer();
          }}
        >
          <Feather name="settings" size={18} color="#666" style={{ marginRight: 10 }} />
          <Text style={styles.footerText}>Settings & Backup</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function DrawerNavigator() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        drawerStyle: {
          width: 280,
          borderTopRightRadius: 20,
          borderBottomRightRadius: 20,
          overflow: 'hidden',
        },
        drawerType: 'slide',
        overlayColor: 'rgba(0,0,0,0.5)',
        headerTintColor: '#333',
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
        },
        headerStyle: {
          backgroundColor: '#fff',
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#f0f0f0',
        },
        headerLeft: () => (
          <TouchableOpacity
            onPress={() => navigation.openDrawer()}
            style={{ marginLeft: 16, padding: 8 }}
          >
            <Feather name="menu" size={24} color={Colors.primary || '#4B7CF3'} />
          </TouchableOpacity>
        ),
      })}
    >
      <Drawer.Screen
        name="Dashboard"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'SpendoraX',
          // headerRight: () => (
          //   <MaterialCommunityIcons
          //     name="database-sync"
          //     size={24}
          //     color={Colors.primary || '#4B7CF3'}
          //     onPress={() => navigation.navigate('Backup')}
          //     style={{ marginRight: 16 }}
          //   />
          // ),
        })}
      />
      <Drawer.Screen name="Transactions" component={TransactionsScreen} />
      <Drawer.Screen name="Budgets" component={BudgetsScreen} />
      <Drawer.Screen name="Categories" component={CategoriesScreen} />
      <Drawer.Screen name="Sources" component={SourcesScreen} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: Colors.primary || '#4B7CF3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary || '#4B7CF3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  headerTextContainer: {
    marginLeft: 15,
  },
  appName: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1A1D20',
  },
  appVersion: {
    fontSize: 12,
    color: '#8A94A6',
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F2F5',
    marginHorizontal: 20,
  },
  scrollContainer: {
    paddingTop: 15,
    paddingHorizontal: 12,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  drawerItemActive: {
    backgroundColor: Colors.primary || '#4B7CF3',
    shadowColor: Colors.primary || '#4B7CF3',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  drawerIcon: {
    marginRight: 14,
  },
  drawerLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4B5563',
  },
  drawerLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  footerContainer: {
    paddingHorizontal: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F2F5',
  },
  footerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  footerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4B5563',
  },
});
