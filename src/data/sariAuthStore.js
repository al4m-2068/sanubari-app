import { create } from "zustand";
import { persist } from "zustand/middleware";

const MOCK_USERS = [
  {
    id: 1,
    name: {
      first: 'Albar',
      last: 'Abdul Malik',
    },
    email: 'albar2806@student.abudzar.sch.id',
    password: '12345678',
    birthDate: '28-06-2010',
    profilePicture: '/albar.png',
  }
]

export const useSariAuthStore = create(
  // persist(
    (set) => ({
      user: MOCK_USERS[0],
      error: null,

      login: (email, password) => {
        const foundUser = MOCK_USERS.find(u => {
          u.email == email && u.password == password
        })

        if (foundUser) {
          set({
            user: foundUser,
            error: null
          })
          return true
        } else {
          set({
            error: 'Akun tidak ditemukan'
          })
          return false
        }
      },
      logout: set({ user: null, error: null }),
    }),
  //   {
  //     name: 'sari-auth'
  //   }
  // // )
)