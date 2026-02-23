const getGymName = (owner) => {
  return owner?.gymDetails?.gymName || owner?.gymName || "Your Gym";
};

const getOwnerName = (owner) => {
  const fullName = [owner?.firstName, owner?.lastName].filter(Boolean).join(" ").trim();
  return fullName || "Gym Team";
};

module.exports = {
  getGymName,
  getOwnerName,
};
