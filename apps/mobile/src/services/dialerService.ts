import { NativeModules, Platform, PermissionsAndroid } from 'react-native';

const { BusDialer } = NativeModules;

export type DialerRole = 'GRANTED' | 'DENIED' | 'UNSUPPORTED';

export async function isDefaultDialer(): Promise<boolean> {
  if (Platform.OS !== 'android' || !BusDialer) return false;
  return BusDialer.isDefaultDialer();
}

export async function requestDialerRole(): Promise<DialerRole> {
  if (Platform.OS !== 'android' || !BusDialer) return 'UNSUPPORTED';
  return BusDialer.requestDialerRole();
}

/** Returns 'direct' if BUS placed the call itself, 'dialer' if system dialer was opened. */
export async function makeCall(number: string): Promise<'direct' | 'dialer'> {
  if (Platform.OS !== 'android' || !BusDialer) {
    // iOS: open tel: URI
    const { Linking } = require('react-native');
    await Linking.openURL(`tel:${number}`);
    return 'dialer';
  }
  // Ensure CALL_PHONE permission before attempting a direct call
  const perm = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.CALL_PHONE);
  if (!perm) {
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CALL_PHONE, {
      title: 'Phone Call Permission',
      message: 'Between Us needs permission to place calls directly.',
      buttonPositive: 'Allow',
      buttonNegative: 'Deny',
    });
  }
  return BusDialer.makeCall(number);
}
