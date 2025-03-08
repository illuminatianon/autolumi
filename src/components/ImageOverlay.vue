const formattedDate = computed(() => {
  if (!props.image?.date) return '';
  // Ensure we're parsing a valid timestamp
  const date = new Date(Number(props.image.date));
  return isNaN(date.getTime()) ? '' : date.toLocaleString();
});
