/**
 * ShareMyMeal — Navigation Stack
 * ==================================
 * Auth stack → Bottom Tabs (Dashboard, Post, Orders, Chat, Profile)
 * Stack navigators for detail screens within each tab.
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { View, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONTS, SPACING, RADIUS } from '../utils/theme';

// Auth Screens
import SplashScreen from '../screens/auth/SplashScreen';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import PhoneEntryScreen from '../screens/auth/PhoneEntryScreen';
import OTPScreen from '../screens/auth/OTPScreen';
import KYCScreen from '../screens/auth/KYCScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';

// Main App Screens
import DashboardScreen from '../screens/home/DashboardScreen';
import ListingDetailScreen from '../screens/home/ListingDetailScreen';
import OrderTrackingScreen from '../screens/orders/OrderTrackingScreen';
import MyOrdersScreen from '../screens/orders/MyOrdersScreen';
import RatingScreen from '../screens/orders/RatingScreen';
import QRPaymentScreen from '../screens/orders/QRPaymentScreen';
import QRScannerScreen from '../screens/orders/QRScannerScreen';
import ChatListScreen from '../screens/chat/ChatListScreen';
import ChatScreen from '../screens/chat/ChatScreen';
import PostMealScreen from '../screens/seller/PostMealScreen';
import MyListingsScreen from '../screens/seller/MyListingsScreen';
import MyProfileScreen from '../screens/profile/MyProfileScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// ── Bottom Tab Navigator ─────────────────────────────────────
function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: styles.tabBar,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarLabelStyle: styles.tabLabel,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Dashboard') iconName = focused ? 'home' : 'home-outline';
          else if (route.name === 'PostMealTab') iconName = focused ? 'add-circle' : 'add-circle-outline';
          else if (route.name === 'MyOrdersTab') iconName = focused ? 'receipt' : 'receipt-outline';
          else if (route.name === 'ChatTab') iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          else if (route.name === 'MyProfile') iconName = focused ? 'person' : 'person-outline';
          return <Ionicons name={iconName} size={focused ? 26 : 22} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
      <Tab.Screen
        name="MyOrdersTab"
        component={MyOrdersScreen}
        options={{ tabBarLabel: 'Orders' }}
      />
      <Tab.Screen
        name="PostMealTab"
        component={PostMealScreen}
        options={{
          tabBarLabel: 'Post',
          tabBarIcon: ({ focused }) => (
            <View style={styles.postButton}>
              <Ionicons name="add" size={28} color={COLORS.textOnPrimary} />
            </View>
          ),
        }}
      />
      <Tab.Screen
        name="ChatTab"
        component={ChatListScreen}
        options={{ tabBarLabel: 'Chat' }}
      />
      <Tab.Screen name="MyProfile" component={MyProfileScreen} options={{ tabBarLabel: 'Profile' }} />
    </Tab.Navigator>
  );
}

// ── Root Stack Navigator ─────────────────────────────────────
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: COLORS.background },
          animation: 'slide_from_right',
        }}
      >
        {/* Auth Flow */}
        <Stack.Screen name="Splash" component={SplashScreen} />
        <Stack.Screen name="Welcome" component={WelcomeScreen} />
        <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
        <Stack.Screen name="OTPVerification" component={OTPScreen} />
        <Stack.Screen name="KYCVerification" component={KYCScreen} />
        <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />

        {/* Main App (Tabs) */}
        <Stack.Screen name="MainApp" component={MainTabs} />

        {/* Detail Screens (pushed on top of tabs) */}
        <Stack.Screen name="ListingDetail" component={ListingDetailScreen} />
        <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} />
        <Stack.Screen name="MyOrders" component={MyOrdersScreen} />
        <Stack.Screen name="Rating" component={RatingScreen} />
        <Stack.Screen name="Chat" component={ChatScreen} />
        <Stack.Screen name="PostMeal" component={PostMealScreen} />
        <Stack.Screen name="MyListings" component={MyListingsScreen} />
        <Stack.Screen name="QRPayment" component={QRPaymentScreen} />
        <Stack.Screen name="QRScanner" component={QRScannerScreen} />
        <Stack.Screen name="Notifications" component={DashboardScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: COLORS.backgroundAlt,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    height: 70,
    paddingBottom: 10,
    paddingTop: 6,
    elevation: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  postButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
    shadowColor: COLORS.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
