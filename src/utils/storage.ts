import { Room, Booking, HotelSettings } from '../types/hotel';
import { INITIAL_ROOMS, INITIAL_BOOKINGS, INITIAL_SETTINGS, DEFAULT_HOURLY_RATES } from '../data/initialData';

const STORAGE_KEYS = {
  ROOMS: 'hotel25_rooms_v1',
  BOOKINGS: 'hotel25_bookings_v1',
  SETTINGS: 'hotel25_settings_v1',
};

function cloneData<T>(data: T): T {
  return JSON.parse(JSON.stringify(data));
}

export function loadStoredData(): {
  rooms: Room[];
  bookings: Booking[];
  settings: HotelSettings;
} {
  try {
    const storedRooms = localStorage.getItem(STORAGE_KEYS.ROOMS);
    const storedBookings = localStorage.getItem(STORAGE_KEYS.BOOKINGS);
    const storedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);

    const parsedRooms: Room[] = storedRooms ? JSON.parse(storedRooms) : cloneData(INITIAL_ROOMS);
    const parsedBookings: Booking[] = storedBookings ? JSON.parse(storedBookings) : cloneData(INITIAL_BOOKINGS);
    const parsedSettings: HotelSettings = storedSettings
      ? JSON.parse(storedSettings)
      : cloneData(INITIAL_SETTINGS);

    if (!parsedSettings.servicesList || !Array.isArray(parsedSettings.servicesList) || parsedSettings.servicesList.length === 0) {
      parsedSettings.servicesList = cloneData(INITIAL_SETTINGS.servicesList);
    }

    parsedSettings.hourlyRates = {
      ...cloneData(DEFAULT_HOURLY_RATES),
      ...(parsedSettings.hourlyRates || {}),
    };

    return {
      rooms: parsedRooms,
      bookings: parsedBookings,
      settings: parsedSettings,
    };
  } catch (error) {
    console.error('Error reading localStorage, reverting to defaults:', error);
    return {
      rooms: cloneData(INITIAL_ROOMS),
      bookings: cloneData(INITIAL_BOOKINGS),
      settings: cloneData(INITIAL_SETTINGS),
    };
  }
}

export function saveStoredData(
  rooms: Room[],
  bookings: Booking[],
  settings: HotelSettings
): void {
  try {
    localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(rooms));
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(bookings));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

export function resetToDefaults(): {
  rooms: Room[];
  bookings: Booking[];
  settings: HotelSettings;
} {
  const defaults = {
    rooms: cloneData(INITIAL_ROOMS),
    bookings: cloneData(INITIAL_BOOKINGS),
    settings: cloneData(INITIAL_SETTINGS),
  };
  try {
    localStorage.setItem(STORAGE_KEYS.ROOMS, JSON.stringify(defaults.rooms));
    localStorage.setItem(STORAGE_KEYS.BOOKINGS, JSON.stringify(defaults.bookings));
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaults.settings));
  } catch (e) {
    console.error(e);
  }
  return defaults;
}
