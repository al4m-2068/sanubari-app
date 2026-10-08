import { createBrowserRouter, Navigate } from "react-router";
import Theme from "../layout/Theme";
import Home from "../pages/Home";
import Insights, { History, Monthly, Overview, Weekly, Yearly } from "../pages/Insights";
import Chatbot, { ChatPage } from "../pages/Chatbot";
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
      { path: 'insights', element: <Insights/>, children: [
        { index: true, element: <Navigate to="overview" replace /> },
        { path: 'overview', element: <Overview/> },
        { path: 'history', element: <History/>, children: [
          { index: true, element: <Navigate to="weekly" replace /> },
          { path: 'weekly', element: <Weekly/> },
          { path: 'monthly', element: <Monthly/> },
          { path: 'yearly', element: <Yearly/> },
        ]},
      ]},
      { path: 'chatbot', element: <Chatbot/> },
      { path: 'chatbot/:chatId', element: <ChatPage/> },
      { path: 'profile', element: <Profile/> },
      { path: 'measure', element: <Camera/> },
    ],
  },
])