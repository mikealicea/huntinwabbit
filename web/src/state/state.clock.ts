import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

const clockSlice = createSlice({
  name: 'clock',
  // Empty on the server and first client render; browser time arrives after hydration.
  initialState: { today: '' },
  reducers: {
    dateChanged(state, action: PayloadAction<string>) {
      state.today = action.payload;
    },
  },
  selectors: {
    selectToday: (state) => state.today,
  },
});

export const { dateChanged } = clockSlice.actions;
export const { selectToday } = clockSlice.selectors;
export const clockReducer = clockSlice.reducer;
