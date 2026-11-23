import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Switch,
  Platform,
  UIManager,
  LayoutAnimation,
} from 'react-native';
import { createDrawerNavigator, DrawerContentScrollView } from '@react-navigation/drawer';
import { MaterialCommunityIcons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Import Screens
import HomeScreen from '../src/screens/HomeScreen';
import TransactionsScreen from '../src/screens/TransactionsScreen';
import BudgetsScreen from '../src/screens/BudgetsScreen';
import CategoriesScreen from '../src/screens/CategoriesScreen';
import SourcesScreen from '../src/screens/SourcesScreen';
import CreditCardsScreen from '../src/screens/CreditCardsScreen';
import LoanDashboardScreen from '../src/screens/LoanDashboardScreen';
import ReportsScreen from '../src/screens/ReportsScreen';
import BillsScreen from '../src/screens/BillsScreen';
import SmartNotepadScreen from '../src/screens/SmartNotepadScreen';
import { Colors } from '../src/components/Theme';
import { useBalanceVisibility } from '../src/context/BalanceVisibilityContext';
import { useTheme } from '../src/context/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const Drawer = createDrawerNavigator();

// Categorized Menu Structure
const menuSections = [
  {
    key: 'daily',
    title: 'Daily Activity',
    icon: 'calendar-text-outline',
    items: [
      {
        name: 'Transactions',
        label: 'Transactions',
        icon: 'format-list-bulleted',
        activeIcon: 'format-list-bulleted',
      },
      {
        name: 'SmartNotepad',
        label: 'Smart Notepad',
        icon: 'notebook-edit-outline',
        activeIcon: 'notebook-edit',
      },
    ],
  },
  {
    key: 'accounts',
    title: 'Accounts & Liabilities',
    icon: 'wallet-outline',
    items: [
      {
        name: 'Sources',
        label: 'Accounts',
        icon: 'bank-outline',
        activeIcon: 'bank',
      },
      {
        name: 'CreditCards',
        label: 'Credit Cards',
        icon: 'credit-card-outline',
        activeIcon: 'credit-card',
      },
      {
        name: 'Loans',
        label: 'Loans',
        icon: 'cash-multiple',
        activeIcon: 'cash-multiple',
      },
    ],
  },
  {
    key: 'planning',
    title: 'Planning & Analytics',
    icon: 'chart-timeline-variant',
    items: [
      {
        name: 'Bills',
        label: 'Bills',
        icon: 'file-document-outline',
        activeIcon: 'file-document',
      },
      {
        name: 'Categories',
        label: 'Categories',
        icon: 'tag-multiple-outline',
        activeIcon: 'tag-multiple',
      },
      {
        name: 'Budgets',
        label: 'Budgets',
        icon: 'chart-pie',
        activeIcon: 'chart-pie',
      },
      {
        name: 'Reports',
        label: 'Reports',
        icon: 'chart-bar',
        activeIcon: 'chart-bar',
      },
    ],
  },
  {
    key: 'settings',
    title: 'Settings & Preferences',
    icon: 'cog-outline',
    items: [
      {
        name: 'NotificationSettings',
        label: 'Notifications',
        icon: 'bell-outline',
        activeIcon: 'bell',
      },
      {
        name: 'SecuritySettings',
        label: 'Security & App Lock',
        icon: 'shield-check-outline',
        activeIcon: 'shield-check',
      },
      {
        name: 'Backup',
        label: 'Settings & Backup',
        icon: 'cloud-sync-outline',
        activeIcon: 'cloud-sync',
      },
    ],
  },
];

function getCategoryForRoute(routeName) {
  if (routeName === 'PaperLedger') return 'daily';
  for (const sec of menuSections) {
    if (sec.items.some((item) => item.name === routeName)) {
      return sec.key;
    }
  }
  return null;
}

const CustomDrawerContent = memo(function CustomDrawerContent(props) {
  const insets = useSafeAreaInsets();
  const { state, navigation } = props;
  const activeRouteName = state.routeNames[state.index];
  const { balanceVisible, toggleBalance } = useBalanceVisibility();
  const { isDarkMode, toggleDarkMode, theme } = useTheme();
  const navigatingRef = useRef(false);

  // Accordion state: strictly only ONE section open at a time ("No multiple open")
  const [openSection, setOpenSection] = useState(() => getCategoryForRoute(activeRouteName));

  useEffect(() => {
    const activeCat = getCategoryForRoute(activeRouteName);
    if (activeCat) {
      setOpenSection(activeCat);
    }
  }, [activeRouteName]);

  const toggleSection = useCallback((sectionKey) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpenSection((prev) => (prev === sectionKey ? null : sectionKey));
  }, []);

  const handleNavigate = useCallback((targetRoute) => {
    if (navigatingRef.current) return;

    if (activeRouteName === targetRoute) {
      navigation.closeDrawer();
      return;
    }

    navigatingRef.current = true;
    navigation.closeDrawer();

    // Give drawer animation (180ms) time to fully close before mounting new screen
    setTimeout(() => {
      navigation.navigate(targetRoute);
      navigatingRef.current = false;
    }, 220);
  }, [activeRouteName, navigation]);

  const activeCategory = getCategoryForRoute(activeRouteName);

  return (
    <View style={{ flex: 1, backgroundColor: theme.drawerBg }}>
      {/* ── HEADER ── */}
      <View
        style={[
          styles.headerContainer,
          {
            paddingTop: Math.max(insets.top, 16) + 12,
            backgroundColor: theme.drawerBg,
          },
        ]}
      >
        <View style={styles.avatarContainer}>
          <Image
            source={require('../assets/logo.png')}
            style={{ width: 44, height: 44, resizeMode: 'contain' }}
          />
        </View>
        <View style={styles.headerTextContainer}>
          <Text style={[styles.appName, { color: theme.textPrimary }]}>SpendoraX</Text>
          <Text style={[styles.appVersion, { color: theme.textSecondary }]}>v4.9.5</Text>
        </View>
      </View>

      <View style={[styles.divider, { backgroundColor: theme.drawerDivider }]} />

      {/* ── CATEGORIZED ACCORDION MENU ── */}
      <DrawerContentScrollView
        {...props}
        contentContainerStyle={styles.scrollContainer}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* Top Direct Item: Dashboard */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => handleNavigate('Dashboard')}
          style={[
            styles.drawerItem,
            activeRouteName === 'Dashboard' && [
              styles.drawerItemActive,
              { backgroundColor: Colors.primary || '#4B7CF3' },
            ],
          ]}
        >
          <MaterialCommunityIcons
            name={activeRouteName === 'Dashboard' ? 'view-dashboard' : 'view-dashboard-outline'}
            size={22}
            color={activeRouteName === 'Dashboard' ? '#fff' : theme.textSecondary}
            style={styles.drawerIcon}
          />
          <Text
            style={[
              styles.drawerLabel,
              { color: activeRouteName === 'Dashboard' ? '#fff' : theme.drawerText },
              activeRouteName === 'Dashboard' && styles.drawerLabelActive,
            ]}
          >
            Dashboard
          </Text>
        </TouchableOpacity>

        {/* Accordion Categories */}
        {menuSections.map((section) => {
          const isOpen = openSection === section.key;
          const isSectionActive = activeCategory === section.key;

          return (
            <View key={section.key} style={styles.sectionWrap}>
              {/* Category Header (Main Menu Item) */}
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => toggleSection(section.key)}
                style={[
                  styles.sectionHeader,
                  isSectionActive && !isOpen && {
                    backgroundColor: isDarkMode ? 'rgba(75, 124, 243, 0.12)' : '#EFF4FF',
                  },
                ]}
              >
                <View style={styles.sectionHeaderLeft}>
                  <MaterialCommunityIcons
                    name={section.icon}
                    size={20}
                    color={
                      isSectionActive
                        ? (Colors.primary || '#4B7CF3')
                        : theme.textSecondary
                    }
                    style={styles.sectionIcon}
                  />
                  <Text
                    style={[
                      styles.sectionTitle,
                      {
                        color: isSectionActive
                          ? (Colors.primary || '#4B7CF3')
                          : theme.drawerText,
                        fontWeight: isSectionActive ? '700' : '600',
                      },
                    ]}
                  >
                    {section.title}
                  </Text>
                </View>

                <View style={styles.sectionHeaderRight}>
                  {/* Subtle active indicator dot if section contains active screen but is collapsed */}
                  {isSectionActive && !isOpen && (
                    <View
                      style={[
                        styles.activeDot,
                        { backgroundColor: Colors.primary || '#4B7CF3' },
                      ]}
                    />
                  )}
                  <MaterialCommunityIcons
                    name={isOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={
                      isOpen || isSectionActive
                        ? (Colors.primary || '#4B7CF3')
                        : theme.textSecondary
                    }
                  />
                </View>
              </TouchableOpacity>

              {/* Submenu Items (Accordion Expanded) */}
              {isOpen && (
                <View
                  style={[
                    styles.submenuContainer,
                    {
                      borderLeftColor: isDarkMode ? '#1E293B' : '#E2E8F0',
                    },
                  ]}
                >
                  {section.items.map((item) => {
                    const isActive = activeRouteName === item.name;
                    return (
                      <TouchableOpacity
                        key={item.name}
                        activeOpacity={0.7}
                        onPress={() => handleNavigate(item.name)}
                        style={[
                          styles.subItem,
                          isActive && [
                            styles.subItemActive,
                            { backgroundColor: Colors.primary || '#4B7CF3' },
                          ],
                        ]}
                      >
                        <MaterialCommunityIcons
                          name={isActive ? (item.activeIcon || item.icon) : item.icon}
                          size={18}
                          color={isActive ? '#fff' : theme.textSecondary}
                          style={styles.subItemIcon}
                        />
                        <Text
                          style={[
                            styles.subItemLabel,
                            { color: isActive ? '#fff' : theme.drawerText },
                            isActive && styles.subItemLabelActive,
                          ]}
                        >
                          {item.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          );
        })}
      </DrawerContentScrollView>

      {/* ── FOOTER: QUICK TOGGLES ── */}
      <View
        style={[
          styles.footerContainer,
          {
            paddingBottom: Math.max(insets.bottom, 12) + 8,
            borderTopColor: theme.drawerDivider,
          },
        ]}
      >
        {/* Balance Toggle */}
        <View style={styles.footerToggleRow}>
          <View style={styles.toggleLabelWrap}>
            <MaterialCommunityIcons
              name={balanceVisible ? 'eye-outline' : 'eye-off-outline'}
              size={18}
              color={theme.textSecondary}
              style={{ marginRight: 10 }}
            />
            <Text style={[styles.footerText, { color: theme.drawerText }]}>Show Balance</Text>
          </View>
          <Switch
            value={balanceVisible}
            onValueChange={toggleBalance}
            trackColor={{ false: theme.border, true: (Colors.primary || '#4B7CF3') + '80' }}
            thumbColor={balanceVisible ? (Colors.primary || '#4B7CF3') : theme.textMuted}
          />
        </View>

        {/* Dark Mode Toggle */}
        <View style={styles.footerToggleRow}>
          <View style={styles.toggleLabelWrap}>
            <MaterialCommunityIcons
              name={isDarkMode ? 'weather-night' : 'white-balance-sunny'}
              size={18}
              color={isDarkMode ? '#F59E0B' : theme.textSecondary}
              style={{ marginRight: 10 }}
            />
            <Text style={[styles.footerText, { color: theme.drawerText }]}>Dark Mode</Text>
          </View>
          <Switch
            value={isDarkMode}
            onValueChange={toggleDarkMode}
            trackColor={{ false: theme.border, true: (Colors.primary || '#4B7CF3') + '80' }}
            thumbColor={isDarkMode ? (Colors.primary || '#4B7CF3') : theme.textMuted}
          />
        </View>
      </View>
    </View>
  );
});

export default function DrawerNavigator() {
  const { isDarkMode, theme } = useTheme();

  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={({ navigation }) => ({
        drawerStyle: {
          width: 280,
          borderTopRightRadius: 20,
          borderBottomRightRadius: 20,
          overflow: 'hidden',
          backgroundColor: theme.drawerBg,
        },
        drawerType: 'front',
        animationDuration: 180,
        overlayColor: isDarkMode ? 'rgba(0,0,0,0.7)' : 'rgba(0,0,0,0.5)',
        headerTintColor: theme.headerText,
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          color: theme.headerText,
        },
        headerStyle: {
          backgroundColor: theme.headerBg,
          elevation: 0,
          shadowOpacity: 0,
          borderBottomWidth: 1,
          borderBottomColor: theme.headerBorder,
        },
        sceneContainerStyle: {
          backgroundColor: theme.bg,
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
          headerRight: () => (
            <MaterialCommunityIcons
              name="magnify"
              size={24}
              color={Colors.primary || '#4B7CF3'}
              onPress={() => navigation.navigate('Search')}
              style={{ marginRight: 16 }}
            />
          ),
        })}
      />
      <Drawer.Screen name="Transactions" component={TransactionsScreen} />
      <Drawer.Screen name="SmartNotepad" component={SmartNotepadScreen} options={{ title: 'Smart Notepad' }} />
      <Drawer.Screen name="PaperLedger" component={SmartNotepadScreen} options={{ title: 'Smart Notepad', drawerItemStyle: { display: 'none' } }} />
      <Drawer.Screen name="Loans" component={LoanDashboardScreen} options={{ title: "Loans" }} />
      <Drawer.Screen name="CreditCards" component={CreditCardsScreen} options={{ title: 'Credit Cards' }} />
      <Drawer.Screen name="Bills" component={BillsScreen} options={{ title: 'Bills' }} />
      <Drawer.Screen name="Budgets" component={BudgetsScreen} />
      <Drawer.Screen name="Sources" component={SourcesScreen} options={{ title: 'Accounts' }} />
      <Drawer.Screen name="Reports" component={ReportsScreen} />
      <Drawer.Screen name="Categories" component={CategoriesScreen} />
    </Drawer.Navigator>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.primary || '#4B7CF3',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.primary || '#4B7CF3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 5,
    elevation: 3,
  },
  headerTextContainer: {
    marginLeft: 14,
  },
  appName: {
    fontSize: 18,
    fontWeight: '800',
  },
  appVersion: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginHorizontal: 16,
  },
  scrollContainer: {
    paddingTop: 10,
    paddingBottom: 10,
    paddingHorizontal: 12,
  },
  drawerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 6,
  },
  drawerItemActive: {
    shadowColor: Colors.primary || '#4B7CF3',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  drawerIcon: {
    marginRight: 12,
  },
  drawerLabel: {
    fontSize: 14.5,
    fontWeight: '600',
  },
  drawerLabelActive: {
    color: '#fff',
    fontWeight: '700',
  },
  sectionWrap: {
    marginBottom: 4,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sectionIcon: {
    marginRight: 12,
  },
  sectionTitle: {
    fontSize: 14,
  },
  sectionHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  submenuContainer: {
    marginLeft: 26,
    paddingLeft: 12,
    borderLeftWidth: 2,
    marginTop: 4,
    marginBottom: 6,
  },
  subItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 3,
  },
  subItemActive: {
    shadowColor: Colors.primary || '#4B7CF3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  subItemIcon: {
    marginRight: 10,
  },
  subItemLabel: {
    fontSize: 13.5,
    fontWeight: '500',
  },
  subItemLabelActive: {
    fontWeight: '700',
  },
  footerContainer: {
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
  },
  footerToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  toggleLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
