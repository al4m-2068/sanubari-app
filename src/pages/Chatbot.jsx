import { twMerge } from "tailwind-merge"
import Button from "../components/atom/Button"
// import { useSariAuthStore } from "../data/sariAuthStore"
import { NavLink, useNavigate, useLocation, /*useParams*/ } from "react-router"
import { useState, useEffect, useLayoutEffect, useRef } from "react"
import { askGemini } from "../services/gemini"
import { useSariAuthStore } from "../data/sariAuthStore"
import sariLogo from '../assets/icons/sanubari.svg'

const suggestionsClass = [
  'bg-th-moss',
  'bg-th-cream-pale',
  'bg-th-oak',
]  

function Chatbot() {
  const [inputText, setInputText] = useState('')
  const textareaRef = useRef(null)
  const navigate = useNavigate()
  
  const handleSend = () => {
    if (!inputText.trim()) return
    navigate('/chatbot/session', { state: { initialQuestion: inputText } })
  }

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    const parent = textarea?.parentElement
    if (!textarea || !parent) return

    textarea.style.height = '12px'
    const parentStyle = window.getComputedStyle(parent)
    const button = parent.querySelector('button')
    const reservedHeight = [
      parentStyle.paddingTop,
      parentStyle.paddingBottom,
      parentStyle.borderTopWidth,
      parentStyle.borderBottomWidth,
      parentStyle.rowGap,
    ].reduce((total, value) => total + (Number.parseFloat(value) || 0), button?.offsetHeight ?? 0)
    const maxParentHeight = Number.parseFloat(parentStyle.maxHeight)
    const maxTextareaHeight = Number.isFinite(maxParentHeight)
      ? Math.max(0, maxParentHeight - reservedHeight)
      : textarea.scrollHeight

    textarea.style.height = `${Math.min(textarea.scrollHeight, maxTextareaHeight)}px`
    textarea.style.overflowY = textarea.scrollHeight > maxTextareaHeight ? 'auto' : 'hidden'
  }, [inputText])
  // const chats = useSariAuthStore(state => state.user.chatData)
  // const recentChatsMeta = chats.slice(0, 3).map(({ topic, chatId }) => ({ topic, chatId }))
  return (
    <div className="flex flex-col h-full pt-16 gap-9 pb-33">
      <div className="flex flex-col h-full w-full gap-11 justify-between">
        <h1 className="text-[64px]/100 font-medium font-cabinet px-4">Start<br/>Chatting.</h1>
        <div className="relative flex flex-col items-center w-full gap-5">
          {/* // QUESTION SUGGESTIONS // */}
          <div className="flex gap-1 w-full overflow-x-auto scrollbar-none fade-x fade-size-x-2xl h-48 box-content p-4 -m-4">
            <NavLink className={twMerge('h-full transition-all duration-500 hover:scale-107 flex-col shrink-0 text-lg/100 font-medium w-40 flex justify-between p-4 -mb-7 rounded-2xl text-th-plain-black items-start', suggestionsClass[1])} to={`/chatbot/session`}><span className="text-xs text-th-oak">Topic Suggestions</span> Why might measurements vary?</NavLink>
            <NavLink className={twMerge('h-full transition-all duration-500 hover:scale-107 shrink-0 text-lg/100 font-medium w-40 flex flex-col justify-between p-4 -mb-7 rounded-2xl text-th-plain-black items-start', suggestionsClass[0])} to={`/chatbot/session`}>
              Compare with my recent measurements
              <div className="flex gap-2 w-full h-full items-end">
                <div className="flex-1 bg-th-plain-white/6 h-[70%] rounded-lg"></div>
                <div className="flex-1 bg-th-plain-white/6 h-[50%] rounded-lg"></div>
                <div className="flex-1 bg-th-plain-white/6 h-[90%] rounded-lg"></div>
              </div>
            </NavLink>
            <NavLink className={twMerge('h-full transition-all duration-500 hover:scale-107 flex-col shrink-0 text-lg/100 font-medium w-40 flex justify-between p-4 -mb-7 rounded-2xl text-th-plain-black items-start', suggestionsClass[2])} to={`/chatbot/session`}><span className="text-xs text-th-plain-black/30">Topic Suggestions</span> How does rPPG work?</NavLink>
          </div>
          <div className="flex flex-col text-xs min-h-25 max-h-40 bg-white border-[1.2px] border-th-plain-grey p-4 rounded-2xl w-full gap-2 has-focus:outline-2 outline-th-green-dark">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Ask me something..."
              className="scrollbar-none rounded-sm w-full min-h-0 placeholder:text-th-plain-grey resize-none focus:outline-0"
            />
            <Button onClick={handleSend} className={'bg-th-green-light size-9 shrink-0 rounded-xl justify-center text-th-green-dark aspect-square self-end'}><i className="fi fi-sr-paper-plane text-base/[80%]"></i></Button>
          </div>
        </div>
      </div>
      {/* <div className="flex flex-col items-center w-full text-xs/100">
        {recentChatsMeta.map(({ chatId, topic }, index) => (
          <NavLink key={chatId} className={twMerge('w-full flex justify-between p-4 h-19 -mb-7 rounded-2xl text-th-plain-black items-start', recentChatsClass[index % 3])} to={`/chatbot/${chatId}`}><span className="flex items-center justify-between w-full h-4">{topic} <i className="fi fi-rr-arrow-right text-base/[80%] text-th-plain-black/20"></i></span></NavLink>
        ))}
      </div> */}
    </div>
  )
}
export default Chatbot

export function ChatPage() {
  const userProfile = useSariAuthStore(state => state.user.profilePicture)
  const location = useLocation()
  const initialQuestion = location.state?.initialQuestion || "Halo!"
  
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
    <div className="flex flex-col items-center w-full h-full gap-2 pt-24 pb-27">      
      <div className="flex flex-col w-full h-full gap-10 overflow-y-auto scrollbar-thumb-th-green-dark scrollbar-thin fade-y font-medium text-sm/[130%]">
        {messages.map((msg, index) => (
          <div key={index} className="flex gap-10 flex-col w-full">
            {msg.sender === 'user' ? (
              <div className="flex flex-col items-end gap-3">
                <img src={userProfile} className="size-10 rounded-2xl" alt="" />
                <p className="w-[80%] rounded-2xl rounded-tr-none p-4 bg-th-green-light border-[1.2px] border-th-green-dark text-th-plain-black">
                  {msg.text}
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-3 text-th-green-darker">
                <img src={sariLogo} className="size-6" alt="" />
                <p className="w-[80%] whitespace-pre-line rounded-2xl rounded-tl-none p-4 bg-th-plain-black/2 text-th-plain-black">
                  {msg.text}
                </p>
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex text-xs italic text-th-plain-grey">
            Sanubari AI sedang berpikir...
          </div>
        )}
        {/* <div className="min-h-[200vh] bg-amber-300 " /> */}
      </div>

      <div className="flex items-center justify-end w-full px-2">
        <input 
          type="text" 
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage(question)}
          placeholder="Ask me something..." 
          className="text-xs h-13 bg-white border-[1.2px] shadow-th-green-light/50 shadow-th-sm border-th-plain-grey pl-6 pr-13 rounded-2xl w-full focus:outline-2 outline-th-green-dark"
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
