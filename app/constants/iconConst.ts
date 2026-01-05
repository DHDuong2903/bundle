export const BUNDLE_ICONS = {
  'none': { label: "None", svg: "" },
  'star': { 
    label: "Star", 
    svg: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 1l2.928 5.928 6.072.886-4.394 4.272 1.037 6.048L10 15.276 4.357 18.134l1.037-6.048L1 7.814l6.072-.886L10 1z"/></svg>' 
  },
  'tag': { 
    label: "Tag", 
    svg: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3.5 2A1.5 1.5 0 0 0 2 3.5v4.586a1.5 1.5 0 0 0 .44 1.06l8.914 8.915a1.5 1.5 0 0 0 2.122 0l4.585-4.586a1.5 1.5 0 0 0 0-2.121L9.146 2.44A1.5 1.5 0 0 0 8.086 2H3.5ZM5.5 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"/></svg>' 
  },
  'bolt': { 
    label: "Flash", 
    svg: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M11.5 1L2 11h6v8l9.5-10h-6V1z"/></svg>' 
  },
  'heart': { 
    label: "Heart", 
    svg: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.22l-.61-.6a5.5 5.5 0 00-7.78 7.77L10 18.78l8.39-8.4a5.5 5.5 0 00-7.78-7.77l-.61.61z"/></svg>' 
  },
  'check': { 
    label: "Verified", 
    svg: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M0 11l2-2 5 5L18 3l2 2L7 18z"/></svg>' 
  },
  'fire': { 
    label: "Hot", 
    svg: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10.35 1.01a.5.5 0 0 0-.7 0C8.33 2.3 2 8.44 2 12.5a8 8 0 1 0 16 0c0-4.06-6.33-10.2-7.65-11.49ZM10 18a5.5 5.5 0 1 1 0-11c0 1.5-1 3-2.5 4.5 2 1 2.5 3.5 2.5 6.5Z"/></svg>' 
  },
  'discount': {
    label: "Discount",
    svg: '<svg viewBox="0 0 20 20" fill="currentColor"><path d="M10 2a8 8 0 100 16 8 8 0 000-16zm.75 11h-1.5v-1.5h1.5V13zm0-3h-1.5V6h1.5v4z"/></svg>'
  },
  'alert': {
    label: "Alert",
    svg: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 2a8 8 0 100 16 8 8 0 000-16zm.75 11h-1.5v-1.5h1.5V13zm0-3h-1.5V6h1.5v4z"/></svg>'
  },
  'info': {
    label: "Info",
    svg: '<svg viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm.75-11.25a.75.75 0 0 0-1.5 0v4.5a.75.75 0 0 0 1.5 0v-4.5Zm-.75 7.5a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"/></svg>'
  }
};

export const ICONS = Object.keys(BUNDLE_ICONS).map(key => ({
  label: BUNDLE_ICONS[key as keyof typeof BUNDLE_ICONS].label,
  value: key
}));
