import { twMerge } from "tailwind-merge"
import Button from "../components/atom/Button"
// import { useSariAuthStore } from "../data/sariAuthStore"
import { NavLink, useNavigate, useLocation /*useParams*/ } from "react-router"
import { useState, useEffect } from "react"
import { askGemini } from "../services/gemini"

const suggestionsClass = [
  'bg-th-moss',
  'bg-th-cream-pale',
  'bg-th-oak',
]  

function Chatbot() {
  const [inputText, setInputText] = useState('')
  const navigate = useNavigate()

  const handleSend = () => {
      if (!inputText.trim()) return
      navigate('/chatbot/session', { state: { initialQuestion: inputText } })
  }
  // const chats = useSariAuthStore(state => state.user.chatData)
  // const recentChatsMeta = chats.slice(0, 3).map(({ topic, chatId }) => ({ topic, chatId }))
  return (
    <div className="flex flex-col items-center justify-center h-full pt-16 gap-9">
      <div className="flex flex-col items-center w-full px-6 text-center gap-11">
        <h1 className="text-4xl/[100%] font-medium font-cabinet">How can I help<br/>you today?</h1>
        <div className="relative flex items-center w-full">
          <input type="text"
            value={inputText} onChange={(e) => setInputText(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask me something..."
            className="text-xs h-13 bg-th-plain-white border-[1.2px] border-th-plain-grey pl-6 pr-13 rounded-2xl w-full" />
          <Button onClick={handleSend} className={'bg-th-green-light size-9 rounded-xl justify-center text-th-green-dark absolute right-2'}><i className="fi fi-sr-paper-plane-top text-base/[80%]"></i></Button>
        </div>
      </div>
      <div className="flex flex-col items-center w-full text-xs/[100%]">
        {/* {recentChatsMeta.map(({ chatId, topic }, index) => (
          <NavLink key={chatId} className={twMerge('w-full flex justify-between p-4 h-19 -mb-7 rounded-2xl text-th-plain-black items-start', recentChatsClass[index % 3])} to={`/chatbot/${chatId}`}><span className="flex items-center justify-between w-full h-4">{topic} <i className="fi fi-rr-arrow-right text-base/[80%] text-th-plain-black/20"></i></span></NavLink>
        ))} */}
        {/* ~ QUESTION SUGGESTIONS ~ */}
        <NavLink className={twMerge('w-full flex justify-between p-4 h-19 -mb-7 rounded-2xl text-th-plain-black items-start', suggestionsClass[0])} to={`/chatbot/session`}><span className="flex items-center justify-between w-full h-4">Best thing to maintain after using lorem ipsum <i className="fi fi-rr-arrow-right text-base/[80%] text-th-plain-black/20"></i></span></NavLink>
        <NavLink className={twMerge('w-full flex justify-between p-4 h-19 -mb-7 rounded-2xl text-th-plain-black items-start', suggestionsClass[1])} to={`/chatbot/session`}><span className="flex items-center justify-between w-full h-4">Best thing to maintain after using lorem ipsum <i className="fi fi-rr-arrow-right text-base/[80%] text-th-plain-black/20"></i></span></NavLink>
        <NavLink className={twMerge('w-full flex justify-between p-4 h-19 -mb-7 rounded-2xl text-th-plain-black items-start', suggestionsClass[2])} to={`/chatbot/session`}><span className="flex items-center justify-between w-full h-4">Best thing to maintain after using lorem ipsum <i className="fi fi-rr-arrow-right text-base/[80%] text-th-plain-black/20"></i></span></NavLink>
      </div>
      <div className="flex flex-col gap-8">
      </div>
    </div>
  )
}
export default Chatbot

export function ChatPage() {
  const location = useLocation()
  const initialQuestion = location.state?.initialQuestion || "Halo!"
  // const { chatId } = useParams()
  // const chats = useSariAuthStore(state => state.user.chatData)
  // const chatMessages = chats.find(c => c.chatId == chatId).chatContent
  const [messages, setMessages] = useState([])
  const [question, setQuestion] = useState('')
  const [loading, setLoading] = useState(false)

  const sendMessage = async (userText) => {
      if (!userText.trim() || loading) return
  
      const updatedMessages = [...messages, { sender: 'user', text: userText }]
      setMessages(updatedMessages)
      setQuestion('')
      setLoading(true)
  
      const aiResponse = await askGemini(userText)
  
      setMessages([...updatedMessages, { sender: 'ai', text: aiResponse }])
      setLoading(false)
    }

  useEffect(() => {
      if (initialQuestion) {
        sendMessage(initialQuestion)
      }
    }, [])
  
  return (
    <div className="flex flex-col items-center w-full h-full pt-24 gap-9">
      <h1 className="text-xs/[110%] font-medium">SARI Chatbot</h1>
      <div className="flex flex-col w-full h-full gap-10">
        {messages.map((msg, index) => (
        <div key={index} className="flex gap-10 flex-col w-full text-sm/[130%]">
          {msg.sender === 'user' ? (
          <div className="flex justify-end">
            <p className="w-[80%] rounded-2xl rounded-tr-none p-4 bg-th-green-light border-[1.2px] border-th-green-dark text-th-green-darker">
              {msg.text}</p>
          </div>
             
          ) : (    
            <div className="flex flex-col gap-6 text-th-plain-black">
              <p className="w-[80%] bg-gray-50 p-4 rounded-2xl border border-gray-100 whitespace-pre-line">
                {msg.text}
              </p>
            </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex text-xs text-gray-400 italic">
            Sanubari AI sedang berpikir...
          </div>
        )}
      </div>

      <div className="flex items-center justify-end w-full pb-34 absolute bottom-0 px-6 bg-gradient-to-t from-white via-white to-transparent pt-6">
        <input 
          type="text" 
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage(question)}
          placeholder="Ask me something..." 
          className="text-xs h-13 bg-th-plain-white border-[1.2px] border-th-plain-grey pl-6 pr-13 rounded-2xl w-full" 
        />
        <Button 
          onClick={() => sendMessage(question)} 
          disabled={loading}
          className={'bg-th-green-light size-9 rounded-xl justify-center right-8 text-th-green-dark absolute'}
        >
          <i className="fi fi-sr-paper-plane-top text-base/[80%]"></i>
        </Button>
      </div>
    </div>
  )
}
