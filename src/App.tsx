import Home from "./pages/Home";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import Layout from "./pages/Layout";
import Login from "./pages/Login";
import NotFound from "./pages/NotFound";
import CheckList from "./components/FormsData/DraftData/CheckList";
const App = () => {
  const router = createBrowserRouter([
    {
      path: "/",
      element: <Layout />,
      children: [
        {
          path: "/",
          element: <Home />,
        },
        { path: "/login", element: <Login /> },
        { path: "*", element: <NotFound /> },
        { path: "/checkList", element: <CheckList /> },
      ],
    },
  ]);
  return <RouterProvider router={router} />;
};

export default App;
