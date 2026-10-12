// Availability inherited from parent sections is shared by the store and reseller API.
export function parentRefilling(id, categories) {
  const seen = new Set();
  while (id) {
    if (seen.has(id)) return true;
    seen.add(id);
    const category = categories.find((c) => c.id === id);
    if (
      !category ||
      category.is_active === false ||
      category.presentation?.availability === "refilling"
    )
      return true;
    id = category.parent_id;
  }
  return false;
}
