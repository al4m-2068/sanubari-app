import { create } from "zustand";
import { persist } from "zustand/middleware";
import '/src/assets/images/DSC05019.JPG';

const MOCK_USERS = [
  {
    id: 1,
    source: 'mock',
    name: {
      first: 'Albar',
      last: 'Abdul Malik',
    },
    email: 'albar2806@student.abudzar.sch.id',
    password: '12345678',
    profilePicture: 'https://m.media-amazon.com/images/M/MV5BMjI1ODZkYTgtYTY3Yy00ZTJkLWFkOTgtZDUyYWM4MzQwNjk0XkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg',
    measurementData: [
      { date: '2026-10-05T14:00:00.000Z', bpm: 102 },
      { date: '2026-10-04T14:20:00.000Z', bpm: 62 },
      { date: '2026-10-03T14:10:00.000Z', bpm: 63 },
      { date: '2026-10-02T14:17:00.000Z', bpm: 61 },
      { date: '2026-10-01T14:15:00.000Z', bpm: 20 },
    ],
    // chatData: [
    //   {chatId: 'almakraimfahit09837723', topic: 'Best thing to maintain after using lorem ipsum', chatContent: [
    //     {talkId: 1, question: 'What is the best thing to maintain after using lorem ipsum?', answer: {text: 'A lorem ipsum should be maintained carefully every lorem ipsum range of time.', images: null}},
    //     {talkId: 2, question: 'How long is using lorem ipsum allowed?', answer: {text: 'A lorem ipsum should not consumed more than lorem ipsum week.', images: null}},
    //   ]},
    //   {chatId: 'almakraimfahit09837893', topic: 'Best thing to maintainas after using lorem ipsum', chatContent: [
    //     {talkId: 1, question: 'What is the best thing to maintain after using lorem ipsum?', answer: {text: 'A lorem ipsum should be maintained carefully every lorem ipsum range of time.', images: null}},
    //     {talkId: 2, question: 'How long is using lorem ipsum allowed?', answer: {text: 'A lorem ipsum should not consumed more than lorem ipsum week.', images: ['https://assets-a1.kompasiana.com/items/album/2021/09/08/koe-no-katachi-netflix-1200-6138792e010190577f651952.jpg', '/src/assets/images/DSC05019.JPG']}},
    //   ]},
    //   {chatId: 'almakraimfahit09837763', topic: 'Best thing to maintain after using lorem ipsum', chatContent: [
    //     {talkId: 1, question: 'What is the best thing to maintain after using lorem ipsum?', answer: {text: 'A lorem ipsum should be maintained carefully every lorem ipsum range of time.', images: null}},
    //     {talkId: 2, question: 'How long is using lorem ipsum allowed?', answer: {text: 'A lorem ipsum should not consumed more than lorem ipsum week.', images: ['https://assets-a1.kompasiana.com/items/album/2021/09/08/koe-no-katachi-netflix-1200-6138792e010190577f651952.jpg', 'https://m.media-amazon.com/images/M/MV5BYWMxYmU3NmItYTczZS00NWJkLWJjNzQtOTk2YTI1ZDAyNWQzXkEyXkFqcGc@._V1_FMjpg_UX1000_.jpg']}},
    //   ]},
    // ]
  }
]

export const useSariAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      error: null,

      clearError: () => set({ error: null }),

      login: (email, password) => {
        const foundUser = MOCK_USERS.find(u =>
          u.email === email && u.password === password
        )

        if (foundUser) {
          set({
            user: foundUser,
            error: null
          })
          return true
        }

        set({
          error: `Email or password don't match or no account registered.`
        })
        return false
      },

      loginWithGoogle: (firebaseUser) => {
        get().syncFirebaseUser(firebaseUser)
        return true
      },

      syncFirebaseUser: (firebaseUser) => {
        const currentUser = get().user

        if (!firebaseUser) {
          if (currentUser?.source === 'firebase') {
            set({ user: null, error: null })
          }
          return
        }

        if (currentUser?.source === 'firebase' && currentUser.id === firebaseUser.uid) {
          return
        }

        set({
          user: {
            id: firebaseUser.uid,
            source: 'firebase',
            name: {
              first: firebaseUser.displayName?.split(' ')[0] || '',
              last: firebaseUser.displayName?.split(' ').slice(1).join(' ') || '',
            },
            email: firebaseUser.email,
            password: null,
            profilePicture: firebaseUser.photoURL,
            measurementData: [],
          },
          error: null,
        })
      },

      signup: (email, password, firstName, lastName) => {
        const foundUser = MOCK_USERS.find(u =>
          u.email === email
        )

        if (foundUser) {
          set({
            error: 'Account already exist'
          })
          return false
        }

        const newUserTemplate = {
          id: MOCK_USERS.length + 1,
          source: 'mock',
          name: {
            first: firstName,
            last: lastName,
          },
          email,
          password,
          profilePicture: null,
          measurementData: [],
        }

        MOCK_USERS.push(newUserTemplate)

        set({
          user: newUserTemplate,
          error: null,
        })

        return true
      },

      logout: () => set({
        user: null,
        error: null,
      }),

      editAccount: (email, password, firstName, lastName, profilePicture) => {
        const currentUser = get().user

        if (!currentUser) {
          set({ error: 'You must be signed in to edit your account.' })
          return false
        }

        const updatedUser = {
          ...currentUser,
          name: {
            ...currentUser.name,
            first: firstName.trim(),
            last: lastName.trim(),
          },
          email: email.trim(),
          password: currentUser.source === 'firebase' ? null : password,
          profilePicture: profilePicture !== undefined ? profilePicture : currentUser.profilePicture,
        }
        
        const mockIndex = MOCK_USERS.findIndex(u => u.id === currentUser.id)
        if (mockIndex !== -1) MOCK_USERS[mockIndex] = updatedUser

        set({
          user: updatedUser,
          error: null,
        })

        return true
      },
    }),

    {
      name: 'sari-auth',
    }
  )
)