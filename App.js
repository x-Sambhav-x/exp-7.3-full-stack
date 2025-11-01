import { useEffect, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:5000");

function App() {
  const [message, setMessage] = useState("");
  const [chat, setChat] = useState([]);

  useEffect(() => {
    socket.on("receive_message", (data) => {
      setChat((prev) => [...prev, data]);
    });

    return () => socket.off("receive_message");
  }, []);

  const sendMessage = () => {
    if (!message) return;
    socket.emit("send_message", message);
    setMessage("");
  };

  return (
    <div style={{ padding: 30 }}>
      <h2>💬 Real-Time Chat</h2>

      <input
        type="text"
        placeholder="Write message..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
      />

      <button onClick={sendMessage}>Send</button>

      <div style={{ marginTop: 20 }}>
        {chat.map((msg, i) => (
          <p key={i}>📩 {msg}</p>
        ))}
      </div>
    </div>
  );
}

export default App;
