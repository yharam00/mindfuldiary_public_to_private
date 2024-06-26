import {useEffect, useState, useRef, React, useCallback} from "react";
import {
    doc,
    getDoc,
    setDoc,
    collection,
    onSnapshot,
    getCountFromServer, updateDoc, arrayUnion, increment, query, where, orderBy, getDocs
} from 'firebase/firestore'
import {db} from "../firebase-config";
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import Col from 'react-bootstrap/Col';
import Form from 'react-bootstrap/Form';
import Button from 'react-bootstrap/Button';
import Card from "react-bootstrap/Card";
import Badge from 'react-bootstrap/Badge';
import Toast from 'react-bootstrap/Toast';
import {BeatLoader, HashLoader} from "react-spinners";
import "react-datepicker/dist/react-datepicker.css";
import {useNavigate} from "react-router-dom";
import Modal from 'react-bootstrap/Modal';
import {ToastContainer} from "react-bootstrap";
import Likert from 'react-likert-scale';

import book_blue from "../img/book_blue.jpg";
import book_purple from "../img/book_purple.jpg";
import chat from "../img/chat.jpg";
import lock from "../img/lock.jpg";
import {selectOptions} from "@testing-library/user-event/dist/select-options";
import config from "./backend_url.js";

const haram_change = config.ngrok_8000;

function Writing(props) {
    const [show, setShow] = useState(false);
    let [loading, setLoading] = useState(false)
    const [sessionStatus, setSessionStatus] = useState(false)
    const receivedText = useRef("");
    const receivedDiary = useRef("");
    const turnCount = useRef(null);
    const sessionInputRef = useRef(null)
    const [session, setSession] = useState("")
    let [inputUser, setInputUser] = useState('')
    let [prompt, setPrompt] = useState('')
    let [module, setModule] = useState('')
    let [diary, setDiary] = useState("")
    let [existing, setExisting] = useState([{"sessionStart": "데이터 불러오기"}])
    const updateProgress = useRef(true)
    let [surveyReady, setSurveyReady] = useState(false)

    const diaryRequest = useRef(false)

    const [modalShow, setModalShow] = useState(false);
    const [modalShow2, setModalShow2] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [textInput, setTextInput] = useState('');
    const notSpoken = useRef(true)
    const navigate = useNavigate()
    const current = new Date();
    const date = `${current.getFullYear()}년 ${current.getMonth() + 1}월 ${current.getDate()}일`;

    const phq1 = useRef(null)
    const phq2 = useRef(null)
    const phq3 = useRef(null)
    const phq4 = useRef(null)
    const phq5 = useRef(null)
    const phq6 = useRef(null)
    const phq7 = useRef(null)
    const phq8 = useRef(null)
    const phq9 = useRef(null)
    const riskLevel = useRef(null)
    const [riskMethod, setRiskMethod] = useState(null)
    const [phqTotal, setPhqTotal] = useState(null)
    const [displayNewQuestion, setDisplayNewQuestion] = useState(false)
    const [checkedItems, setCheckedItems] = useState({
        suicide: false,
        selfharm: false
    });
    const [reflection, setReflection] = useState(null)
    const micUsage = useRef(0)

    const risk_sent = useRef(false)


    // voice input feature
    useEffect(() => {
        if (!('webkitSpeechRecognition' in window)) {
            alert('Web Speech API is not supported in this browser. Please use Google Chrome.');
            return;
        }
        const recognition = new window.webkitSpeechRecognition();
        recognition.interimResults = true;
        recognition.lang = 'ko';
        recognition.continuous = true;

        recognition.onresult = (event) => {
            const transcript = Array.from(event.results)
                .map((result) => result[0])
                .map((result) => result.transcript)
                .join('');
            setTextInput(textInput + " " + transcript);
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event);
            setIsListening(false);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        if (isListening) {
            recognition.start({continuous: true});
        } else {
            recognition.stop({continuous: true});
        }

        return () => {
            recognition.abort();
        };
    }, [isListening]);

    // monitoring firebase data
    useEffect(() => {

        async function renewList() {
            const existingSession = await receiveSessionData()
            setExisting(existingSession)
            updateProgress.current = false
            console.log(existing)
        }

        if (sessionStatus === false && updateProgress.current === true) {
            renewList()
        } else if (sessionStatus && session !== '') {
            const diaryDocRef = doc(db, 'session', props.userMail, 'diary', session);
            const unsubscribe = onSnapshot(diaryDocRef, (doc) => {
                const data = doc.data();
                // Tracking "outputFromLM" field
                if (data) {
                    console.log("새로고침")
                    receivedText.current = data['outputFromLM'];
                    getLastSentence(receivedText.current);
                    receivedDiary.current = data['diary'];
                    if (receivedDiary.current !== "") {
                        if (receivedDiary.current !== diary) {
                            setShow(true)
                            console.log("새로고침_다이어리")
                            setDiary(receivedDiary.current)
                        }
                    }
                    turnCount.current = data['turn'];
                }
            });
            return () => {
                unsubscribe();
            };
        }
    });

    async function receiveSessionData() {
        let tempArr = [];
        const userDocRef = doc(db, 'session', props.userMail);
        const diaryCompleteCollRef = collection(userDocRef, 'diary');
        const q = query(diaryCompleteCollRef, where('isFinished', '==', false), orderBy('sessionStart', 'desc'));
        const querySnapshot = await getDocs(q);
        querySnapshot.forEach((doc) => {
            // doc.data() is never undefined for query doc snapshots
            // console.log(doc.id, " => ", doc.data());
            tempArr.push(doc.data());
        });
        let resultArr = tempArr.slice(0, 4);
        return resultArr;
    }

    const currentTime = new Date();
    const currentHour = currentTime.getHours();

    // const isEvening = currentHour >= 19 && currentHour < 24;
    const isEvening = true;


    // create NewDoc
    async function createNewDoc(newSession) {
        if (session !== "") {
            const docRef = doc(db, "session", props.userMail, "diary", session);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const message = docSnap.data().outputFromLM;
                console.log("진행중인 세션이 있습니다");
                if (message.length === 0) {
                    assemblePrompt()
                } else {
                    console.log("기존에 언어모델 문장 존재");
                    setSessionStatus(true)
                    setLoading(true)
                }
            } else {
                const myArray = ["만나서 반가워요, 오늘 하루 어떻게 지내셨나요?", "오늘 하루 어땠어요? 말하고 싶은 것이 있다면 자유롭게 이야기해주세요.", "안녕하세요! 오늘 하루는 어땠나요?", "오늘 하루도 정말 고생 많으셨어요. 어떤 일이 있었는지 얘기해주세요.", "오늘도 무사히 지나간 것에 감사한 마음이 드네요. 오늘 하루는 어땠나요?", "오늘은 어떤 새로운 것을 경험했나요? 무엇을 경험했는지 얘기해주세요.", "오늘은 어떤 고민이 있었나요? 저와 함께 고민을 얘기해봐요."]
                await setDoc(doc(db, "session", props.userMail, "diary", session), {
                    outputFromLM: {
                        "options": [myArray[Math.floor(Math.random() * myArray.length)]],
                        "module": "Rapport building",
                        "summary": "none",
                        "diary": "none"
                    },
                    conversation: [],
                    isFinished: false,
                    module: "",
                    fiveOptionFromLLM: [],
                    diary: "",
                    topic: "",
                    sessionStart: Math.floor(Date.now() / 1000),
                    summary: "",
                    history: [],
                    turn: 0,
                    sessionNumber: session,
                    history_operator: [],
                    reviewMode: "W",
                    phq9score: phq1.current + phq2.current + phq3.current + phq4.current + phq5.current + phq6.current + phq6.current + phq7.current + phq8.current + phq9.current,
                    phq_item_score: [phq1, phq2, phq3, phq4, phq5, phq6, phq7, phq8, phq9],
                    riskLevel: riskLevel.current,
                    riskType: checkedItems,
                    riskMethod: riskMethod

                });
            }
            setSessionStatus(true)
            setLoading(true)
        } else {
            const docRef = doc(db, "session", props.userMail, "diary", newSession);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const message = docSnap.data().outputFromLM;
                console.log("진행중인 세션이 있습니다");
                if (message.length === 0) {
                    assemblePrompt()
                } else {
                    console.log("기존에 언어모델 문장 존재");
                    setSessionStatus(true)
                    setLoading(true)
                }
            } else {
                let myArray
                if (riskLevel.current === 9 && checkedItems['suicide'] === true) {
                    sendEmail_preWriting()
                    setModalShow2(true)
                } else {
                    myArray = ["만나서 반가워요, 오늘 하루 어떻게 지내셨나요?", "오늘 하루 어땠어요? 말하고 싶은 것이 있다면 자유롭게 이야기해주세요.", "안녕하세요! 오늘 하루는 어땠나요?", "오늘 하루도 정말 고생 많으셨어요. 어떤 일이 있었는지 얘기해주세요.", "오늘도 무사히 지나간 것에 감사한 마음이 드네요. 오늘 하루는 어땠나요?", "오늘은 어떤 새로운 것을 경험했나요? 무엇을 경험했는지 얘기해주세요.", "오늘은 어떤 고민이 있었나요? 저와 함께 고민을 얘기해봐요."]

                    await setDoc(doc(db, "session", props.userMail, "diary", newSession), {
                        outputFromLM: {
                            "options": [myArray[Math.floor(Math.random() * myArray.length)]],
                            "module": "Rapport building",
                            "summary": "none",
                            "diary": "none"
                        },
                        conversation: [],
                        isFinished: false,
                        module: "",
                        fiveOptionFromLLM: [],
                        diary: "",
                        topic: "",
                        sessionStart: Math.floor(Date.now() / 1000),
                        summary: "",
                        history: [],
                        turn: 0,
                        sessionNumber: newSession,
                        history_operator: [],
                        reviewMode: "W",
                        phq9score: phq1.current + phq2.current + phq3.current + phq4.current + phq5.current + phq6.current + phq6.current + phq7.current + phq8.current + phq9.current,
                        phq_item_score: [phq1, phq2, phq3, phq4, phq5, phq6, phq7, phq8, phq9],
                        riskLevel: riskLevel.current,
                        riskType: checkedItems,
                        riskMethod: riskMethod

                    });
                    setSessionStatus(true)
                    setLoading(true)
                }
            }
        }
    }

    async function submitDiary() {
        await setDoc(doc(db, "session", props.userMail, "diary", session), {
            sessionEnd: Math.floor(Date.now() / 1000),
            isFinished: true,
            like: 0,
            muscle: 0,
            diary: diary
        }, {merge: true});
        // navigateToReview()
        // setSurveyReady(true)
        setSurveyReady(true)
    }

    async function submitDiary2() {
        await setDoc(doc(db, "session", props.userMail, "diary", session), {
            sessionEnd: Math.floor(Date.now() / 1000),
            isFinished: true,
            like: 0,
            muscle: 0,
            diary: "오늘의 일기 쓰기 완료! 오늘 작성한 다이어리는 보이지 않아요",
            diary_hidden: diary
        }, {merge: true});
        setSurveyReady(true)
        // navigateToReview()
    }

    async function endSession() {
        setDoc(doc(db, "session", props.userMail, "diary", session), {
            phq9score: phqTotal,
            phq_item_score: [phq1, phq2, phq3, phq4, phq5, phq6, phq7, phq8, phq9],
            riskLevel: riskLevel.current,
            riskMethod: riskMethod,
            reflection: reflection,
            isFinished: true
        }, {merge: true});
        await navigateToReview()
    }

    async function endSession_risk() {
        setDoc(doc(db, "session", props.userMail, "diary", session), {
            phq9score: phqTotal,
            phq_item_score: [phq1, phq2, phq3, phq4, phq5, phq6, phq7, phq8, phq9],
            riskLevel: riskLevel.current,
            riskMethod: riskMethod,
            riskType: checkedItems,
            isFinished: true,
            like: 0,
            muscle: 0,
            diary: "오늘의 일기 쓰기 완료! 오늘 작성한 다이어리는 보이지 않아요",
            diary_hidden: diary,
            sessionEnd: Math.floor(Date.now() / 1000)
        }, {merge: true});
        await navigateToReview()
    }

    async function editDiary(diary_edit) {
        await setDoc(doc(db, "session", props.userMail, "diary", session), {
            diary: diary_edit
        }, {merge: true});
    }

    const toggleListening = () => {
        setIsListening((prevState) => !prevState);
    };


    // Modal management
    function navigateToReview() {
        navigate("/list")
    }

    function handleClick() {
        setModalShow(false);
        setTimeout(() => {
            submitDiary();
        }, 500);
    }

    function handleClick2() {
        setModalShow(false);
        setTimeout(() => {
            submitDiary2();
        }, 500);
    }

    function MyVerticallyCenteredModal_risk(props) {
        return (
            <Modal
                {...props}
                size="lg"
                aria-labelledby="contained-modal-title-vcenter"
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title id="contained-modal-title-vcenter">
                        마음챙김 다이어리
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <h5>마음일기 사용 중 힘든 상황이 확인됩니다.</h5>
                    <p>정말 걱정돼요. 지금 힘든 상황이며 긴급한 도움이 필요한 것 같습니다. 오늘은 일기를 쓰기보다, 상태를 돌아보시고 지금 견디기 힘든 상황을 겪고 있다면 언제든지 응급실 혹은
                        병원에 도움을 요청해보세요.</p>
                    <p>괜찮아졌을 때 우리 다시 만나요. 자살예방 상담전화 1393.</p>
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={endSession_risk}>오늘은 일찍 종료하고, 다음에 다시 만나요</Button>
                </Modal.Footer>
            </Modal>
        );
    }


    function MyVerticallyCenteredModal(props) {
        return (
            <Modal
                {...props}
                size="lg"
                aria-labelledby="contained-modal-title-vcenter"
                centered
            >
                <Modal.Header closeButton>
                    <Modal.Title id="contained-modal-title-vcenter">
                        마음챙김 다이어리를 종료하시겠어요?
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body>
                    <h5>아래와 같이 오늘의 다이어리가 저장됩니다 📝</h5>
                    <p>
                        {diary}
                    </p>
                </Modal.Body>
                <Modal.Footer>
                    <Button onClick={handleClick2}>🌧️ 일기 숨기고 종료하기</Button>
                    <Button onClick={handleClick}>🌤️ 일기 저장하고 종료하기</Button>
                </Modal.Footer>
            </Modal>
        );
    }

    const handleChange = (event) => {
        setCheckedItems({...checkedItems, [event.target.value]: event.target.checked});
    };

    // checking Prompt exist
    async function getLastSentence(response) {
        let a = setTimeout(() => {
            setModule(response["module"])
            setPrompt(response["options"][0])
            if (module === "Risky situations") {
                setSessionStatus(false)
                setModalShow2(true)
                if (risk_sent.current === false) {
                    sendEmail_inWriting()
                    risk_sent.current = true
                }
            }
            if (prompt) {
                if (module === "Sensitive topic") {
                    if (risk_sent.current === false) {
                        sendEmail_inWriting()
                        risk_sent.current = true
                    }

                }
                if ((prompt).trim() === "") {
                    setLoading(true)
                } else {
                    setLoading(false)
                }
            }

        }, 10)
        return () => {
            clearTimeout(a)
        }
    }

    async function assemblePrompt() {
        const docRef3 = doc(db, "session", props.userMail, "diary", session);
        const docSnap = await getDoc(docRef3);
        if (docSnap.exists()) {
            const readyRequest = docSnap.data().conversation;
            console.log(docSnap.data())
            const turn_temp = docSnap.data().turn
            requestPrompt(readyRequest, props.userMail, session, turn_temp, module)
            if (turn_temp > 3) {
                console.log("다이어리 요청 들어감");
                diaryInit(readyRequest, props.userMail, session);
                diaryRequest.current = true;
            }
            turnCount.current = turn_temp;
        } else {
            console.log("No such document!");
        }
    }

    // https://mindfuljournal-fzesr.run.goorm.site
    // http://0.0.0.0:8000


    function requestPrompt(text, user, num, turn, module, model) {
        return fetch(haram_change+'/standalone', {
            method: 'POST',
            body: JSON.stringify({
                'text': text,
                'user': user,
                'num': num,
                'turn': turn,
                'module': module,
                'model': "none"
            })
        })
            .catch(err => console.log(err));
    }


    function requestPrompt_sensitive(text, user, num, turn, module, model) {
        return fetch(haram_change+'/standalone_sensitive', {
            method: 'POST',
            body: JSON.stringify({
                'text': text,
                'user': user,
                'num': num,
                'turn': turn,
                'module': module,
                'model': "none"
            })
        })
            .catch(err => console.log(err));
    }


    function Unix_timestamp(t) {
        var date = new Date(t * 1000);
        var year = date.getFullYear();
        var month = "0" + (date.getMonth() + 1);
        var day = "0" + date.getDate();
        var hour = "0" + date.getHours();
        var minute = "0" + date.getMinutes();
        var second = "0" + date.getSeconds();
        return month.substr(-2) + "월 " + day.substr(-2) + "일, " + hour.substr(-2) + ":" + minute.substr(-2) + ":" + second.substr(-2);
    }

    function PreviewComponent() {

        return (
            <>
                <p>
                    각 질문 문항에 대해 체크해주세요
                </p>
                <div className="grid">
                    <p>기분이 가라앉거나, 우울하거나, 희망이 없다고 느꼈다.</p>
                    <Likert
                        id="1"
                        responses={[
                            {value: 0, text: "전혀 그렇지 않다"},
                            {value: 1, text: "가끔 그렇다"},
                            {value: 2, text: "자주 그렇다"},
                            {value: 3, text: "거의 항상 그렇다"}
                        ]}
                        onChange={(val) => phq1.current = val["value"]}
                    />
                    &nbsp;
                    <p>평소 하던 일에 대한 흥미가 없어지거나 즐거움을 느끼지 못했다.</p>
                    <Likert
                        id="2"
                        responses={[
                            {value: 0, text: "전혀 그렇지 않다"},
                            {value: 1, text: "가끔 그렇다"},
                            {value: 2, text: "자주 그렇다"},
                            {value: 3, text: "거의 항상 그렇다"}
                        ]}
                        onChange={(val) => phq2.current = val["value"]}

                    />
                    &nbsp;
                    <p>잠들기가 어렵거나 자주 깼다/혹은 너무 많이 잤다.</p>
                    <Likert
                        id="3"
                        responses={[
                            {value: 0, text: "전혀 그렇지 않다"},
                            {value: 1, text: "가끔 그렇다"},
                            {value: 2, text: "자주 그렇다"},
                            {value: 3, text: "거의 항상 그렇다"}
                        ]}
                        onChange={(val) => phq3.current = val["value"]}

                    />
                    &nbsp;
                    <p>평소보다 식욕이 줄었다/혹은 평소보다 많이 먹었다.</p>
                    <Likert
                        id="4"
                        responses={[
                            {value: 0, text: "전혀 그렇지 않다"},
                            {value: 1, text: "가끔 그렇다"},
                            {value: 2, text: "자주 그렇다"},
                            {value: 3, text: "거의 항상 그렇다"}
                        ]}
                        onChange={(val) => phq4.current = val["value"]}

                    />
                    &nbsp;
                    <p>다른 사람들이 눈치 챌 정도로 평소보다 말과 행동 이 느려졌다/혹은 너무 안절부절 못해서 가만히 앉아있을 수 없었다.</p>
                    <Likert
                        id="5"
                        responses={[
                            {value: 0, text: "전혀 그렇지 않다"},
                            {value: 1, text: "가끔 그렇다"},
                            {value: 2, text: "자주 그렇다"},
                            {value: 3, text: "거의 항상 그렇다"}
                        ]}
                        onChange={(val) => phq5.current = val["value"]}

                    />
                    &nbsp;
                    <p>피곤하고 기운이 없었다.</p>
                    <Likert
                        id="6"
                        responses={[
                            {value: 0, text: "전혀 그렇지 않다"},
                            {value: 1, text: "가끔 그렇다"},
                            {value: 2, text: "자주 그렇다"},
                            {value: 3, text: "거의 항상 그렇다"}
                        ]}
                        onChange={(val) => phq6.current = val["value"]}

                    />
                    &nbsp;
                    <p>내가 잘못 했거나, 실패했다는 생각이 들었다/혹은 자신과 가족을 실망시켰다고 생각했다.</p>
                    <Likert
                        id="7"
                        responses={[
                            {value: 0, text: "전혀 그렇지 않다"},
                            {value: 1, text: "가끔 그렇다"},
                            {value: 2, text: "자주 그렇다"},
                            {value: 3, text: "거의 항상 그렇다"}
                        ]}
                        onChange={(val) => phq7.current = val["value"]}

                    />
                    &nbsp;
                    <p>신문을 읽거나 TV를 보는 것과 같은 일상적인 일에도 집중할 수가 없었다.</p>
                    <Likert
                        id="8"
                        responses={[
                            {value: 0, text: "전혀 그렇지 않다"},
                            {value: 1, text: "가끔 그렇다"},
                            {value: 2, text: "자주 그렇다"},
                            {value: 3, text: "거의 항상 그렇다"}
                        ]}
                        onChange={(val) => phq8.current = val["value"]}

                    />
                    &nbsp;
                    <p>차라리 죽는 것이 더 낫겠다고 생각했다/혹은 자해할 생각을 했다.</p>
                    <Likert
                        id="9"
                        responses={[
                            {value: 0, text: "전혀 그렇지 않다"},
                            {value: 1, text: "가끔 그렇다"},
                            {value: 2, text: "자주 그렇다"},
                            {value: 3, text: "거의 항상 그렇다"}
                        ]}
                        onChange={(val) => phq9.current = val["value"]}
                    />
                    &nbsp;
                    <p>직전 다이어리 작성 이후, 자해 또는 자살을 시도한 적이 있나요</p>
                    <Likert
                        id="10"
                        responses={[
                            {value: 0, text: "아니다"},
                            {value: 1, text: "그렇다"}
                        ]}
                        onChange={(val) => {
                            riskLevel.current = val["value"];
                            if (val["value"] === 1) {
                                setDisplayNewQuestion(true);
                            } else {
                                setDisplayNewQuestion(false);
                            }
                        }}
                    />
                    {displayNewQuestion &&
                        <>
                            <p>무엇을 시도했나요?<br/>
                                <label>
                                    <input type="checkbox" value="suicide" checked={checkedItems.suicide}
                                           onChange={handleChange}/>
                                </label> 자살
                                &nbsp;&nbsp;
                                <label>
                                    <input type="checkbox" value="selfharm" checked={checkedItems.selfharm}
                                           onChange={handleChange}/>
                                </label> 자해</p>


                            <p>어떤방법으로 시도했나요</p>
                            <Form.Control
                                type="text"
                                as="textarea"
                                rows={3}
                                id="userInput"
                                value={riskMethod}
                                onChange={(e) => setRiskMethod(e.target.value)}
                            />
                            &nbsp;
                        </>
                    }


                </div>
            </>
        );
    }

    function navigateToGuide() {
        navigate("/guide")
    }

    function navigateToGuide2() {
        navigate("/guide2")
    }

    function navigateToGuide3() {
        navigate("/guide3")
    }

    function navigateToGuide4() {
        navigate("/guide4")
    }


    function diaryInit(text, user, num) {
        return fetch(haram_change+'/diary', {
            method: 'POST',
            body: JSON.stringify({
                'text': text,
                'user': user,
                'num': num
            })
        })
            .catch(err => console.log(err));
    }

    function sendEmail(session) {
        let risk_person = ["0824jl@naver.com"];
        let to

        if (risk_person.includes(props.userMail)) {
            to = ['taewankim@snu.ac.kr', 'ikarosforeve@naver.com', 'twave09@naver.com']
        }
        else {
            to = 'taewankim@snu.ac.kr';
        }


        let pStatus = "정의안됨"
        if (riskLevel.current === 1 && checkedItems['suicide'] === true) {
            pStatus = "!응급군!"
            to = ['taewankim@snu.ac.kr', 'ikarosforeve@naver.com', 'twave09@naver.com']
        } else if (phq9.current === 3 || checkedItems['selfharm'] === true) {
            pStatus = "위험군"
            to = ['taewankim@snu.ac.kr', 'ikarosforeve@naver.com', 'twave09@naver.com']
        } else {
            pStatus = "관리군"
        }
        const check = "https://pilot-operator.vercel.app/writing?userName=" + props.userMail + "&session=" + session
        const subject = '[마음챙김][' + pStatus + "]" + props.userName + props.userMail;
        const body = '사용자id: ' + props.userMail + '\n환자 이름: ' + props.userName + '\n세션번호: ' + session + '\nPHQ총점: ' + phqTotal + "\n위험정도\nPHQ9번: " + phq9.current + "\n자살/자해시도: " + riskLevel.current + "\n자살시도: " + checkedItems['suicide'] + "\n자해시도: " + checkedItems['selfharm'] + "\n방법: " + riskMethod + "\n실시간 대화내용: " + check;

        fetch('https://algodiary--xpgmf.run.goorm.site/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({to, subject, body}),
        })
            .then(response => response.json())
            .then(data => console.log(data))
            .catch((error) => console.error('Error:', error));
    }

    function sendEmail_inWriting() {
        let risk_person = ["0824jl@naver.com"];
        let to

        if (risk_person.includes(props.userMail)) {
            to = ['taewankim@snu.ac.kr', 'ikarosforeve@naver.com']
        }
        else {
            to = ['taewankim@snu.ac.kr', 'ikarosforeve@naver.com']
        }

        let pStatus = "정의안됨"
        if (riskLevel.current === 1 && checkedItems['suicide'] === true) {
            pStatus = "!응급군!"
            // to = ['taewankim@snu.ac.kr', 'ikarosforeve@naver.com', 'twave09@naver.com']
        } else if (phq9.current === 3 || checkedItems['selfharm'] === true) {
            pStatus = "위험군"
            // to = ['taewankim@snu.ac.kr', 'ikarosforeve@naver.com']
        } else {
            pStatus = "관리군"
        }
        const check = "https://pilot-operator.vercel.app/writing?userName=" + props.userMail + "&session=" + session
        const subject = '[작성중_위험감지][' + pStatus + "]" + props.userName + props.userMail;
        const body = '사용자id: ' + props.userMail + '\n환자 이름: ' + props.userName + '\n세션번호: ' + session + '\nPHQ총점: ' + phqTotal + "\n위험정도\nPHQ9번: " + phq9.current + "\n자살/자해시도: " + riskLevel.current + "\n자살시도: " + checkedItems['suicide'] + "\n자해시도: " + checkedItems['selfharm'] + "\n방법: " + riskMethod + "\n실시간 대화내용: " + check;

        fetch('https://algodiary--xpgmf.run.goorm.site/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({to, subject, body}),
        })
            .then(response => response.json())
            .then(data => console.log(data))
            .catch((error) => console.error('Error:', error));
    }

    function sendEmail_preWriting() {
        let risk_person = ["0824jl@naver.com"];
        let to

        if (risk_person.includes(props.userMail)) {
            to = ['taewankim@snu.ac.kr', 'ikarosforeve@naver.com']
        }
        else {
            to = ['taewankim@snu.ac.kr', 'ikarosforeve@naver.com']
        }

        let pStatus = "정의안됨"
        if (riskLevel.current === 1 && checkedItems['suicide'] === true) {
            pStatus = "!응급군!"
            // to = ['taewankim@snu.ac.kr', 'ikarosforeve@naver.com', 'twave09@naver.com']
        } else if (phq9.current === 3 || checkedItems['selfharm'] === true) {
            pStatus = "위험군"
            // to = ['taewankim@snu.ac.kr', 'ikarosforeve@naver.com']
        } else {
            pStatus = "관리군"
        }
        const check = "https://pilot-operator.vercel.app/writing?userName=" + props.userMail + "&session=" + session
        const subject = '[위험감지_세션시작안됨][' + pStatus + "]" + props.userName + props.userMail;
        const body = '사용자id: ' + props.userMail + '\n환자 이름: ' + props.userName + '\n세션번호: ' + session + '\nPHQ총점: ' + phqTotal + "\n위험정도\nPHQ9번: " + phq9.current + "\n자살/자해시도: " + riskLevel.current + "\n자살시도: " + checkedItems['suicide'] + "\n자해시도: " + checkedItems['selfharm'] + "\n방법: " + riskMethod + "\n실시간 대화내용: " + check;

        fetch('https://algodiary--xpgmf.run.goorm.site/send-email', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({to, subject, body}),
        })
            .then(response => response.json())
            .then(data => console.log(data))
            .catch((error) => console.error('Error:', error));
    }


    function getMentalHealthStatus() {
        if (phq9.current > 1) {
            return "정말 힘드신 것 같습니다. 전문가의 도움이 꼭 필요합니다. 1588-9191에서도 도움을 받으실 수 있습니다.";
        } else if (phqTotal >= 0 && phqTotal <= 4) {
            return "안정적인 상태에요! 앞으로 계속 만나요!";
        } else if (phqTotal >= 5 && phqTotal <= 9) {
            return "조금 지친거 같아요. 도움이 필요할 수 있습니다.";
        } else if (phqTotal >= 10 && phqTotal <= 19) {
            return "정말 많이 힘들어보여요. 전문적인 상담이나 치료가 필요할 것 같아요. 우리 함께 힘내보아요";
        } else if (phqTotal >= 20 && phqTotal <= 27) {
            return "정말 힘드신 것 같습니다. 전문가의 도움이 꼭 필요합니다. 1393 또는 1588-9191에서도 도움을 받으실 수 있습니다.";
        } else {
            return "오류가 발생했어요";
        }
    }


    async function addConversationFromUser(input, comment) {
        let system_temp = {"role": "assistant", "content": prompt}
        let user_temp = {"role": "user", "content": input};
        let history_temp = {
            "prompt": prompt,
            "userInput": input,
            "module": module,
            "comment": comment,
            "turn": turnCount.current
        }
        const docRef2 = doc(db, "session", props.userMail, "diary", session);
        const docSnap2 = await getDoc(docRef2);
        if (docSnap2.exists()) {
            const message = docSnap2.data().conversation;
            const history = docSnap2.data().history;
            message[message.length] = system_temp;
            message[message.length] = user_temp;
            history[history.length] = history_temp
            let a = setTimeout(async () => {
                await setDoc(docRef2, {
                    conversation: message,
                    outputFromLM: "",
                    history: history,
                    micUsage: micUsage.current
                }, {merge: true});
                await updateDoc(docRef2, {
                    turn: increment(1)
                })
                assemblePrompt();
                setLoading(true);
                notSpoken.current = true
                setTextInput("");
            }, 500)
            return () => {
                clearTimeout(a)
            }
        } else {
            console.log("데이터 없음");
        }
    }


    if (surveyReady === true) {
        if (phqTotal === null) {
            return (
                <Container>
                    <Row>
                        <div className="loading_box">
                        <span className="desktop-view">
                            {date}<br/><b>먼저 나의 마음상태를 확인해봐요</b> 😀
                        </span>
                            <span className="smartphone-view">
                            {date}<br/><b>먼저 마음상태를<br/>확인해봐요</b> 😀
                        </span>
                        </div>
                    </Row>
                    <Row>
                        <Col>
                            {PreviewComponent()}
                            <Button
                                variant="primary"
                                style={{backgroundColor: "007AFF", fontWeight: "600"}}
                                onClick={async () => {
                                    if (phq1.current !== null && phq2.current !== null && phq3.current !== null && phq4.current !== null && phq5.current !== null && phq6.current !== null && phq7.current !== null && phq8.current !== null && phq9.current !== null) {
                                        setSurveyReady(false)
                                        setPhqTotal(phq1.current + phq2.current + phq3.current + phq4.current + phq5.current + phq6.current + phq7.current + phq8.current + phq9.current)
                                        const newSession = String(Math.floor(Date.now() / 1000));
                                        setSession(newSession)
                                        await sendEmail(newSession)
                                        await createNewDoc(newSession)
                                    } else {
                                        alert("응답이 완료되지 않은 문항이 있습니다. 확인해주세요.")
                                    }

                                }}
                            >🌤️ 일기 작성하기
                            </Button>
                        </Col>
                    </Row>
                    &nbsp;

                </Container>
            )
        } else {
            return (
                <Container>
                    <Row>
                        <div className="loading_box">
                        <span className="desktop-view">
                            <b>오늘의 일기 쓰기 완료</b> 😀
                        </span>
                            <span className="smartphone-view">
                            <b>일기 쓰기 완료!</b> 😀
                        </span>
                        </div>
                    </Row>
                    <Row>

                        <span className="desktop-view">
                            <b>🧠 오늘의 정신건강</b>
                        <br/>{getMentalHealthStatus()}
                        </span>

                        <span className="smartphone-view-text">
                         <b>🧠 오늘의 정신건강</b>
                            <br/>{getMentalHealthStatus()}
                        </span>
                        &nbsp;

                        <span className="desktop-view">
                         <b>🗓️ 오늘의 일기<br/></b>
                            {diary}<br/> <br/>

                            <div className="writing_box">
                    <Form.Label htmlFor="userInput">
                       <span className="desktop-view">
                            ✏️ 일기를 쓰며 느낀점, 들었던 생각, 다짐이 있다면 자유롭게 남겨주세요
                        </span>
                        <span className="smartphone-view-text-tiny">
                            ✏️ 일기를 쓰며 느낀점, 들었던 생각, 다짐이 있다면 자유롭게 남겨주세요
                        </span>
                    </Form.Label>
                    <Form.Control
                        type="text"
                        as="textarea"
                        rows={3}
                        id="userInput"
                        value={reflection}
                        onChange={(e) => setReflection(e.target.value)}
                    />
                </div>


                            <Button
                                variant="primary"
                                style={{backgroundColor: "007AFF", fontWeight: "600"}}
                                onClick={() => {
                                    endSession()
                                }}
                            >👍 오늘의 일기쓰기 완료!
                    </Button>
                        </span>

                        <span className="smartphone-view-text">
                         <b>🗓️ 오늘의 일기<br/></b>
                            {diary} <br/><br/>
                            <div className="writing_box">
                    <Form.Label htmlFor="userInput">
                       <span className="desktop-view">
                            ✏️ 일기를 쓰며 느낀점, 들었던 생각, 다짐이 있다면 자유롭게 남겨주세요
                        </span>
                        <span className="smartphone-view-text-tiny">
                            ✏️ 일기를 쓰며 느낀점, 들었던 생각, 다짐이 있다면 자유롭게 남겨주세요
                        </span>
                    </Form.Label>
                    <Form.Control
                        type="text"
                        as="textarea"
                        rows={3}
                        id="userInput"
                        value={reflection}
                        onChange={(e) => setReflection(e.target.value)}
                    />

                </div>

                            <Button
                                variant="primary"
                                style={{backgroundColor: "007AFF", fontWeight: "600"}}
                                onClick={() => {
                                    endSession()
                                }}
                            >👍 오늘의 일기쓰기 완료!
                    </Button>
                        </span>

                    </Row>


                </Container>
            )
        }


    } else if (sessionStatus === false) {

        return (

            <div>
                {isEvening ? (
                    <Container>
                        <MyVerticallyCenteredModal_risk
                            show={modalShow2}
                            onHide={() => setModalShow2(false)}
                        />
                        <Row>
                            <div className="loading_box">
                        <span className="desktop-view">
                            {date}<br/><b>마음챙김 다이어리를 시작합니다</b> 😀
                        </span>
                                <span className="smartphone-view">
                            {date}<br/><b>마음챙김 다이어리를<br/>시작합니다</b> 😀
                        </span>
                            </div>
                        </Row>
                        <Row>
                            <Col>
                                <div className="d-grid gap-2">
                                    <Button
                                        variant="primary"
                                        style={{backgroundColor: "007AFF", fontWeight: "600"}}
                                        onClick={() => {
                                            setSurveyReady(true)
                                        }}
                                        /*onClick={async () => {
                                            const newSession = String(Math.floor(Date.now() / 1000));
                                            await setSession(newSession)
                                            await createNewDoc(newSession)
                                            await sendEmail()
                                        }}*/
                                    >📝 오늘의 세션 시작하기
                                    </Button>
                                    &nbsp;
                                    {/*<Form.Text className="text-muted">
                                        종료되지 않은 세션을 이어 진행하려면<br/>아래에서 진행중인 세션을 선택해주세요
                                    </Form.Text>*/}
                                </div>
                            </Col>
                            <Col></Col>
                        </Row>
                        &nbsp;
                        {/*<Row xs={'auto'} md={1} className="g-4">
                            {existing.map((_, idx) => (
                                <Col>
                                    <Button
                                        variant="dark"
                                        style={{backgroundColor: "007AFF", fontWeight: "400"}}
                                        onClick={async () => {
                                            const newSession = String(existing[idx]["sessionStart"]);
                                            await setSession(newSession)
                                            await sendEmail(newSession)
                                            await createNewDoc(newSession)
                                        }}>
                                        {Unix_timestamp(existing[idx]["sessionStart"])}
                                    </Button>
                                </Col>
                            ))}


                        </Row>*/}
                    </Container>
                ) : (
                    <Container>
                        <Row>
                            <div className="loading_box">
                        <span className="desktop-view">
                          <br/>마음챙김 다이어리는<br/><b>저녁 7시부터 밤12시 사이에 작성할 수 있어요.</b><br/>저녁에 다시만나요 🕰️
                        </span>
                                <span className="smartphone-view">
                            <br/>마음챙김 다이어리는<br/><b>저녁 7시부터 밤12시 사이에<br/>작성할 수 있어요.</b><br/>저녁에 다시만나요 🕰️
                        </span>
                            </div>
                        </Row>
                        <Row>
                            <Col>
                                <div className="d-grid gap-2">
                                    <Button
                                        variant="primary"
                                        style={{backgroundColor: "007AFF", fontWeight: "600"}}
                                        onClick={() => {
                                            navigateToReview()
                                        }}
                                    >📖 일기 다시보기
                                    </Button>
                                    <Form.Text className="text-muted">
                                        내가 썼던 일기를 돌아보거나, 마음챙김 다이어리에 대해 더 알아보세요.
                                    </Form.Text>
                                </div>
                            </Col>
                            <Col></Col>
                        </Row>
                        <span className="center_temp">
                                                &nbsp;

                            <Row xs={1} md={2} className="g-4">

                    <Col>
                        <Card onClick={() => {
                            navigateToGuide()
                        }}
                              style={{cursor: 'pointer'}}>
                            <Card.Img variant="top" src={book_purple}/>
                            <Card.Body>
                                <Card.Title><b>일기쓰기와 정신건강</b></Card.Title>
                                <Card.Text>
                                    일기를 작성하는 것이 어떻게 정신건강에 도움이 될까요?
                                </Card.Text>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col>
                        <Card onClick={() => {
                            navigateToGuide2()
                        }}
                              style={{cursor: 'pointer'}}>
                            <Card.Img variant="top" src={chat}/>
                            <Card.Body>
                                <Card.Title><b>누구와 말하는 건가요?</b></Card.Title>
                                <Card.Text>
                                    마음챙김 다이어리가 어떻게 동작 원리에 대해 알아봅니다.
                                </Card.Text>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col>
                        <Card onClick={() => {
                            navigateToGuide3()
                        }}
                              style={{cursor: 'pointer'}}>
                            <Card.Img variant="top" src={lock}/>
                            <Card.Body>
                                <Card.Title><b>개인정보는 어떻게 관리되나요?</b></Card.Title>
                                <Card.Text>
                                    나의 데이터는 어떻게 관리되는지 알아봅니다.</Card.Text>
                            </Card.Body>
                        </Card>
                    </Col>
                    <Col>
                        <Card onClick={() => {
                            navigateToGuide4()
                        }}
                              style={{cursor: 'pointer'}}>
                            <Card.Img variant="top" src={book_blue}/>
                            <Card.Body>
                                <Card.Title><b>어떻게 적는건가요?</b></Card.Title>
                                <Card.Text>
                                    정신건강에 도움이 되는 일상 기록이란?
                                </Card.Text>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>

                </span>
                        &nbsp;

                    </Container>
                )}
            </div>


        )
    } else {
        return (
            <Container>
                <Row>
                    <div>
                        <Badge bg="secondary">
                            {module}
                        </Badge>{' '}

                        {loading === true ? <Loading/> :
                            <Userinput prompt={prompt} setInputUser={setInputUser} inputUser={inputUser}
                                       addConversationFromUser={addConversationFromUser}
                                       setLoading={setLoading}
                                       turnCount={turnCount.current} setDiary={setDiary} textInput={textInput}
                                       setTextInput={setTextInput} toggleListening={toggleListening}
                                       isListening={isListening} setShow={setShow} show={show} module={module} micUsage={micUsage}/>}
                    </div>
                </Row>
                <Row>
                    {turnCount.current > 3 && loading === false ?
                        <DiaryView diary={diary} submitDiary={submitDiary} editDiary={editDiary}
                                   setModalShow={setModalShow}/> :
                        <div>&nbsp;</div>}
                </Row>


                {/*<Form.Text muted>⚠️ 현재 마음챙김 다이어리는 초기게버전으로, 불완전한 내용을 표시할 수 있습니다.<br/>마음챙김 다이어리의 메시지에 의존하거나 과도하게 수용하지 않는 것이 중요합니다.</Form.Text>*/}

                <MyVerticallyCenteredModal
                    show={modalShow}
                    onHide={() => setModalShow(false)}
                />
                <div className="footer"><Form.Text muted>⚠️ 현재 마음챙김 다이어리는 초기버전으로, 불완전한 내용을 표시할 수 있습니다.<br/>인공지능 메시지에 의존하거나 과도하게 수용하지 않는 것이 중요합니다.<br/>완성도에 아쉬움이 있는 경우 다음의 <a
                    href="http://pf.kakao.com/_xnSPgxj/chat" target="_blank" rel="noopener noreferrer"
                    style={{textDecoration: 'none', color: '#007AFF'}}>카톡 채널로</a> 피드백을 남겨주세요.</Form.Text></div>
            </Container>
        )
    }
}

//User input screen component
function Userinput(props) {
    const temp_comment_input = useRef("");
    return (
        <div>
            <Row>
                <ToastContainer className="p-3" position={"top-center"}>
                    <Toast onClose={() => props.setShow(false)} show={props.show} delay={3000} autohide>
                        <Toast.Header>
                            <strong className="me-auto">알림</strong>
                            <small>이창은 3초 후 자동으로 닫힘니다</small>
                        </Toast.Header>
                        <Toast.Body>새로운 다이어리가 작성되었어요.</Toast.Body>
                    </Toast>
                </ToastContainer>
                <Col>
                    <div className="prompt_box">
                            <span className="desktop-view">
                                <div className="tte">
                                {props.prompt}
                            </div>
                            </span>
                        <span className="smartphone-view-text-large">
                                <div className="tte">
                                {props.prompt}
                            </div>
                            </span>
                    </div>
                </Col>
            </Row>
            <Row>
                <div className="writing_box">
                    <Form.Label htmlFor="userInput">
                       <span className="desktop-view">
                            ✏️ 나의 일기 입력하기
                        </span>
                        <span className="smartphone-view-text-tiny">
                            ✏️ 나의 일기 입력하기
                        </span>
                    </Form.Label>
                    <Form.Control
                        type="text"
                        as="textarea"
                        rows={3}
                        id="userInput"
                        value={props.textInput}
                        onChange={(e) => props.setTextInput(e.target.value)}
                    />
                    <Form.Text id="userInput" muted>
                        📝 편안하고 자유롭게 최근에 있었던 일을 작성해주세요.
                    </Form.Text>
                </div>
                <Row className="desktop-view">
                    <Col>
                        <div className="d-grid gap-1">
                            <Button
                                variant="dark"
                                style={{backgroundColor: "007AFF", fontWeight: "600"}}
                                onClick={()=>{
                                if (props.isListening === false) {
                                    props.toggleListening()
                                    props.micUsage.current = props.micUsage.current + 1
                                }
                                else {
                                    props.toggleListening()
                                }

                                }}>
                                {/*onClick={props.toggleListening}*/}
                                {props.isListening ? '🛑 응답 종료하기' : '🎙️ 목소리로 응답하기'}
                            </Button>
                        </div>
                    </Col>
                    <Col>
                        <div className="d-grid gap-1">
                            <Button
                                variant="primary"
                                style={{backgroundColor: "007AFF", fontWeight: "600"}}
                                onClick={() => {
                                    (function () {
                                        if (props.textInput.length < 1) {
                                            alert("입력한 내용이 너무 짧아요. 조금만 더 입력해볼까요?")
                                        } else if (props.isListening === true) {
                                            props.toggleListening()
                                            props.addConversationFromUser(props.textInput, temp_comment_input.current)
                                        } else {
                                            props.addConversationFromUser(props.textInput, temp_comment_input.current)
                                        }
                                    })()
                                }}>💬 응답 전송하기</Button>
                        </div>
                    </Col>
                    <Form.Text id="userInput" muted>
                        📖 3턴이 넘어가면 다이어리가 자동으로 생성됩니다.
                    </Form.Text>

                </Row>
                <div className="smartphone-view">
                    <div className="d-grid gap-2">
                        <Button
                            variant="dark"
                            style={{backgroundColor: "007AFF", fontWeight: "600"}}
                            onClick={()=>{
                                if (props.isListening === false) {
                                    props.toggleListening()
                                    props.micUsage.current = props.micUsage.current + 1
                                }
                                else {
                                    props.toggleListening()
                                }

                                }}>
                            {props.isListening ? '🛑 응답 종료하기' : '🎙️ 목소리로 응답하기'}
                        </Button>
                        <Button
                            variant="primary"
                            style={{backgroundColor: "007AFF", fontWeight: "600"}}
                            onClick={() => {
                                (function () {
                                    if (props.textInput.length < 1) {
                                        alert("입력한 내용이 너무 짧아요. 조금만 더 입력해볼까요?")
                                    } else if (props.isListening === true) {
                                        props.toggleListening()
                                        props.addConversationFromUser(props.textInput, temp_comment_input.current)
                                    } else {
                                        props.addConversationFromUser(props.textInput, temp_comment_input.current)
                                    }
                                })()
                            }}>💬 응답 전송하기</Button>
                    </div>
                    <Form.Text id="userInput" muted>
                        📖 3턴이 넘어가면 다이어리가 자동으로 생성됩니다.
                    </Form.Text>
                </div>
            </Row>
        </div>
    )
}

function DiaryView(props) {
    const [editMode, setEditMode] = useState(false);
    const [diaryedit, setDiaryedit] = useState("");

    if (props.diary === "") {
        return (
            <div className="inwriting_review_box">
                <Row>
                    <div className="loading_box_2">
                        <div>
                            <BeatLoader
                                color="#007AFF"
                                speedMultiplier={0.6}
                            />
                        </div>
                        <span className="desktop-view">
                                <Form.Text id="userInput" muted><div style={{fontSize: '20px'}}>일기 작성중입니다. 다이어리 작성을 더 진행해주세요</div></Form.Text>
                            </span>
                        <span className="smartphone-view">
                                <Form.Text id="userInput" muted><div style={{fontSize: '15px'}}>일기 작성중입니다.<br/>다이어리 작성을 더 진행해주세요</div></Form.Text>
                            </span>
                    </div>
                </Row>
            </div>
        )
    } else if (editMode === false) {
        return (
            <div className="inwriting_review_box">
                &nbsp;
                <Row xs={'auto'} md={1} className="g-4">
                    <Col>
                        <Card style={{
                            width: '100%',
                        }}>
                            <Card.Body>
                                <Card.Title>
                                    오늘의 마음챙김 다이어리
                                </Card.Title>

                                <Card.Text>
                                    <div>{props.diary}</div>
                                </Card.Text>
                                &nbsp;
                                <Card.Subtitle className="mb-2 text">
                                    <span className="likebutton"
                                          onClick={() => {
                                              setEditMode(true)
                                              setDiaryedit(props.diary)
                                          }}
                                    >✍️수정하기️</span>
                                </Card.Subtitle>
                            </Card.Body>

                        </Card>


                        <Col>
                            <div className="submission"></div>
                            <div className="d-grid gap-2">

                                <Button
                                    variant="dark"
                                    style={{backgroundColor: "007AFF", fontWeight: "600"}}
                                    onClick={() => {
                                        props.setModalShow(true)
                                    }}
                                >📝 일기 저장하고 종료하기</Button>
                            </div>
                            <div className="footer"></div>
                        </Col>
                    </Col>
                </Row>
            </div>
        )
    } else if (editMode) {
        return (
            <div className="inwriting_review_box">
                <Form.Label htmlFor="userInput">
                        <span className="desktop-view">
                            📝️ 내용을 수정해주세요
                        </span>
                    <span className="smartphone-view-text-tiny">
                            📝️ 내용을 수정해주세요
                        </span>
                </Form.Label>
                <Form.Control
                    type="text"
                    as="textarea"
                    rows={5}
                    id="userInput"
                    value={diaryedit}
                    onChange={(e) => setDiaryedit(e.target.value)}
                />

                <div className="submission"></div>
                <div className="d-grid gap-2">
                    <Button
                        variant="dark"
                        style={{backgroundColor: "007AFF", fontWeight: "600"}}
                        onClick={() => {
                            props.editDiary(diaryedit)
                            setEditMode(false)
                        }}
                    >📝 일기 수정완료</Button>
                </div>
                <div className="footer"></div>

            </div>
        )
    }
}

function Loading() {

    const quotes = [
        "삶이 있는 한 희망은 있다 -키케로",
        "산다는것 그것은 치열한 전투이다. -로망로랑",
        "하루에 3시간을 걸으면 7년 후에 지구를 한바퀴 돌 수 있다. -사무엘존슨",
        "언제나 현재에 집중할수 있다면 행복할것이다. -파울로 코엘료",
        "신은 용기있는자를 결코 버리지 않는다 -켄러",
        "피할수 없으면 즐겨라 – 로버트 엘리엇",
        "단순하게 살아라. 현대인은 쓸데없는 절차와 일 때문에 얼마나 복잡한 삶을 살아가는가?-이드리스 샤흐",
        "먼저핀꽃은 먼저진다 남보다 먼저 공을 세우려고 조급히 서둘것이 아니다 – 채근담",
        "행복한 삶을 살기위해 필요한 것은 거의 없다. -마르쿠스 아우렐리우스 안토니우스",
        "절대 어제를 후회하지 마라 . 인생은 오늘의 나 안에 있고 내일은 스스로 만드는 것이다 L.론허바드",
        "어리석은 자는 멀리서 행복을 찾고, 현명한 자는 자신의 발치에서 행복을 키워간다 -제임스 오펜하임",
        "삶이 있는 한 희망은 있다 -키케로",
        "하루에 3시간을 걸으면 7년 후에 지구를 한바퀴 돌 수 있다. -사무엘존슨",
        "언제나 현재에 집중할수 있다면 행복할것이다. -파울로 코엘료",
        "신은 용기있는자를 결코 버리지 않는다 -켄러",
        "단순하게 살아라. 현대인은 쓸데없는 절차와 일 때문에 얼마나 복잡한 삶을 살아가는가?-이드리스 샤흐",
        "먼저핀꽃은 먼저진다 남보다 먼저 공을 세우려고 조급히 서둘것이 아니다 – 채근담",
        "행복한 삶을 살기위해 필요한 것은 거의 없다. -마르쿠스 아우렐리우스 안토니우스",
        "절대 어제를 후회하지 마라 . 인생은 오늘의 나 안에 있고 내일은 스스로 만드는 것이다 L.론허바드",
        "어리석은 자는 멀리서 행복을 찾고, 현명한 자는 자신의 발치에서 행복을 키워간다 -제임스 오펜하임",
        "1퍼센트의 가능성, 그것이 나의 길이다. -나폴레옹",
        "꿈을 계속 간직하고 있으면 반드시 실현할 때가 온다. -괴테",
        "화려한 일을 추구하지 말라. 중요한 것은 스스로의 재능이며, 자신의 행동에 쏟아 붓는 사랑의 정도이다. -머더 테레사",
        "눈물과 더불어 빵을 먹어 보지 않은 자는 인생의 참다운 맛을 모른다. -괴테",
        "진짜 문제는 사람들의 마음이다. 그것은 절대로 물리학이나 윤리학의 문제가 아니다. -아인슈타인",
        "해야 할 것을 하라. 모든 것은 타인의 행복을 위해서, 동시에 특히 나의 행복을 위해서이다. -톨스토이",
        "사람이 여행을 하는 것은 도착하기 위해서가 아니라 여행하기 위해서이다. -괴테",
        "화가 날 때는 100까지 세라. 최악일 때는 욕설을 퍼부어라. -마크 트웨인",
        "재산을 잃은 사람은 많이 잃은 것이고, 친구를 잃은 사람은 더많이 잃은 것이며, 용기를 잃은 사람은 모든것을 잃은 것이다. -세르반테스",
        "돈이란 바닷물과도 같다. 그것은 마시면 마실수록 목이 말라진다. -쇼펜하우어",
        "이룰수 없는 꿈을 꾸고 이길수 없는 적과 싸우며, 이룰수 없는 사랑을 하고 견딜 수 없는 고통을 견디고, 잡을수 없는 저 하늘의 별도 잡자. -세르반테스",
        "고개 숙이지 마십시오. 세상을 똑바로 정면으로 바라보십시오. -헬렌 켈러",
        "고난의 시기에 동요하지 않는 것, 이것은 진정 칭찬받을 만한 뛰어난 인물의 증거다. -베토벤",
        "사막이 아름다운 것은 어딘가에 샘이 숨겨져 있기 때문이다 – 생떽쥐베리"]

    const randomMessage = quotes[Math.floor(Math.random() * quotes.length)];

    return (
        <div>
            <Row>
                <Col>
                    <div className="loading_box">
                        <div>
                            <HashLoader
                                color="#007AFF"
                                speedMultiplier={0.9}
                            />
                        </div>
                        &nbsp;
                        <div>지금까지의 이야기를<br/>정리중입니다</div>
                    </div>
                    <span className="desktop-view">
                             💬 {randomMessage}
                        </span>
                    <span className="smartphone-view-text-tiny">
                             💬 {randomMessage}
                        </span>
                </Col>
            </Row>
        </div>
    )
}

export default Writing