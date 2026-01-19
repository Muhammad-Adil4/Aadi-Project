import { createSlice, } from "@reduxjs/toolkit";
import type { PayloadAction } from "@reduxjs/toolkit";
export interface UserData {
  id: string;
  name: string;
  email: string;
}

// 2️⃣ Define the slice state
export interface UserState {
  user: UserData | null;
}

const initialState: UserState = {
  user: null,
};

const userSlice = createSlice({
  name: "user",
  initialState,
  reducers: {
    setUser: (state, action: PayloadAction<UserData>) => {
      state.user = action.payload;
    },
    clearUser: (state) => {
      state.user = null;
    },
    updateUserName: (state, action: PayloadAction<string>) => {
      if (state.user) {
        state.user.name = action.payload;
      }
    },
  },
});

export const { setUser, clearUser, updateUserName } = userSlice.actions;
export default userSlice.reducer;
