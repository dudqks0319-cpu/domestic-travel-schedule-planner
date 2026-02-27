const Colors = {
  common: {
    white: "#FFFFFF",
    black: "#1A1A2E",
    gray50: "#F8F9FA",
    gray100: "#F1F3F5",
    gray200: "#E9ECEF",
    gray300: "#DEE2E6",
    gray400: "#ADB5BD",
    gray500: "#868E96",
    gray600: "#495057",
    gray700: "#343A40",
    gray800: "#212529",
    success: "#51CF66",
    warning: "#FCC419",
    error: "#FF6B6B",
    info: "#339AF0",
    markerHotel: "#FF6B6B",
    markerAttraction: "#4A90E2",
    markerRestaurant: "#F5A623",
    markerCafe: "#8B572A",
    markerHospital: "#FF0000",
    markerPharmacy: "#0066FF",
    markerKids: "#FFD93D"
  },
  young: {
    primary: "#4A90E2",
    primaryLight: "#74B3FF",
    primaryDark: "#2E6BC6",
    secondary: "#F5A623",
    secondaryLight: "#FFD280",
    background: "#FFFFFF",
    card: "#F8F9FA",
    text: "#1A1A2E",
    textSub: "#868E96",
    accent: "#FF6B9D",
    gradient: ["#4A90E2", "#74B3FF"]
  },
  family: {
    primary: "#7ED321",
    primaryLight: "#A8E86C",
    primaryDark: "#5CA811",
    secondary: "#FFD93D",
    secondaryLight: "#FFE680",
    background: "#FFFFFF",
    card: "#F8FFF0",
    text: "#1A1A2E",
    textSub: "#868E96",
    accent: "#FF9F43",
    gradient: ["#7ED321", "#A8E86C"]
  },
  senior: {
    primary: "#0D9488",
    primaryLight: "#2DD4BF",
    primaryDark: "#0F766E",
    secondary: "#F59E0B",
    secondaryLight: "#FBBF24",
    background: "#FFFFFF",
    card: "#F3FFFD",
    text: "#1A1A2E",
    textSub: "#6C757D",
    accent: "#E74C3C",
    gradient: ["#0D9488", "#2DD4BF"]
  },
  route: {
    car: "#4A90E2",
    transit: "#7ED321",
    walk: "#F5A623",
    selected: "#FF6B6B"
  },
  schedule: {
    day1: "#4A90E2",
    day2: "#7ED321",
    day3: "#F5A623",
    day4: "#FF6B6B",
    day5: "#0D9488",
    attraction: "#E8F4FD",
    restaurant: "#FFF3E0",
    cafe: "#FBE9E7",
    hotel: "#FCE4EC",
    travel: "#F3E5F5",
    flight: "#E0F7FA"
  }
} as const;

export default Colors;
