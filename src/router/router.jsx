import { createBrowserRouter } from "react-router";
import Theme from "../layout/Theme";
import Home from "../pages/Home";
import Insights from "../pages/Insights";
import Chatbot from "../pages/Chatbot";
import AuthLayout from "../layout/AuthLayout";
import SignIn from "../pages/auth/SignIn";
import Profile from "../pages/Profile";
import Camera from "../pages/Camera";

export const router = createBrowserRouter([
  {
    path: '/auth',
    element: <AuthLayout/>,
    children: [
      { path: 'sign-in', element: <SignIn/> }
    ]
  },
  {
    path: '/',
    element: <Theme/>,
    children: [
      { index: true, element: <Home/> },
      { path: 'insights', element: <Insights/> },
      { path: 'chatbot', element: <Chatbot/> },
      { path: 'profile', element: <Profile/> },
      { path: 'measure', element: <Camera/> },
    ],
  },
])