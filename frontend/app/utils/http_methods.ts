import axios from "axios";
const HTTP_BASE_URL = "http://localhost:3000";

export const getRoomData = async (roomId: string, userName: string) => {
  try {
    const resp = await axios.get(`${HTTP_BASE_URL}/room/data/${roomId}`, {
      params: { user_name: userName },
    });

    if (resp.data.status === "success") {
      return { success: true, data: resp.data };
    } else {
      return { success: false, message: resp.data.message };
    }
  } catch (error: any) {
    const errorMessage = error.response?.data?.message || "Network error occurred";
    return { success: false, message: errorMessage };
  }
};
