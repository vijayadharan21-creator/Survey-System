const calculateDistance = (
  latitude1,
  longitude1,
  latitude2,
  longitude2
) => {
  const toRadians = (value) => {
    return (value * Math.PI) / 180;
  };

  const earthRadiusKm = 6371;

  const lat1 = toRadians(latitude1);
  const lat2 = toRadians(latitude2);

  const deltaLat = toRadians(latitude2 - latitude1);
  const deltaLng = toRadians(
    longitude2 - longitude1
  );

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLng / 2) ** 2;

  const c =
    2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
};

module.exports = calculateDistance;