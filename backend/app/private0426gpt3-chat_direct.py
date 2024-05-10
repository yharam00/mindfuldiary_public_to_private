# -*- coding: utf-8 -*-
import base64
import sys
from dotenv import load_dotenv
import os
from pydantic import BaseModel
from sendgrid import SendGridAPIClient
from sendgrid.helpers.mail import Mail
from fastapi import Request, FastAPI
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials
from firebase_admin import firestore
import openai
import time
from starlette.responses import FileResponse

# nohup python3 /workspace/MindfulJournal/backend/main.py&
# ps ux
# kill -9 PID번호

# CORS 설정
app = FastAPI()
# origins = ["*", "http://localhost:3000", "localhost:3000", "mindful-journal-frontend-s8zk.vercel.app", "https://mindful-journal-frontend-s8zk.vercel.app/", "https://mindful-journal.vercel.app/", "https://llm-diary-deploy-kpvw.vercel.app/"]
origins = ["*", "http://localhost:3000", "localhost:3000"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Firebase초기화 및 openAI api key 설정
load_dotenv()
gptapi = os.getenv("openai_mindfuldiary_v0")
sendgridapi = os.getenv("sengridapi_taewan")
firebaseadminsdk = os.getenv("firebaseadminsdk_location")
cred = credentials.Certificate(firebaseadminsdk)
app_1 = firebase_admin.initialize_app(cred)
db = firestore.client()
openai.api_key = gptapi


print("연결시작")


# Counselor persona 설정
# persona modifier
directive = "Conslor persona: Directive Counselor\nAttitude: assertive, and goal-oriented\n"
client_centered = "Conslor persona: Client-Centered Counselor\nAttitude: Empathetic, supportive, and non-directive\n"
cognitive = "Counslor persona: Cognitive-Behavioral Counselor\nAttitude: Problem-solving, structured, and evidence-based\n"
humanistic = "Counslor persona: Humanistic-Existential Counselor\nAttitude: Holistic, growth-oriented, and philosophical\n"
nopersona = ""
Counslor_persona = [nopersona, nopersona, nopersona]

# Firebase에 데이터 업로드
def upload(response, user, num, topic):
    doc_ref = db.collection(u'session').document(user).collection(u'diary').document(num)
    doc_ref.set({
        u'outputFromLM': response,
        u'topic': topic
    }, merge=True)

def upload_operator(response, user, num, topic):
    doc_ref = db.collection(u'session').document(user).collection(u'diary').document(num)

    doc = doc_ref.get()
    if doc.exists:
        # The document exists, you can append to the 'history_serverside' field
        doc_ref.update({
            u'outputForReview': response,
            u'history_serverside': firestore.ArrayUnion([{'response': response}]),
            # This will add the new data to the existing list
            u'status': "new",
        })
    else:
        # The document does not exist, you need to create it first
        doc_ref.set({
            u'outputForReview': response,
            u'history_serverside': [{'response': response}],  # This will create a list with your new data
            u'status': "new",
        })

    doc_ref.set({
        u'outputForReview': response,
        u'status': "new",
        u'topic': topic
    }, merge=True)

def upload_diary(response, user, num):
    doc_ref = db.collection(u'session').document(user).collection(u'diary').document(num)
    doc_ref.set({
        u'diary': response
    }, merge=True)


# 일기 생성 함수
def diary(text):
    print("다이어리 시작")
    conversationString = ""
    test = ""
    for i in range(0, len(text)):
        if text[i]["role"] == "assistant":
            test = test + "Psychotherapist: " + text[i]["content"] + "\n"
        elif text[i]["role"] == "user":
            conversationString = conversationString + "Patient: " + text[i]["content"] + "\n"
    print(conversationString)
    prompt_for_diary = [{"role": "system",
                         "content": "From the dialogue provided below, generate a diary entry as though you are the patient. Your entry should accurately summarize the day's events, feelings, and memorable moments as per the patient's conversation. It's crucial that the diary entry stays true to the patient's words and experiences, and doesn't include additional context or events not mentioned by the patient. Please write the entry as a personal reflection of the patient's day, staying as faithful to the original dialogue as possible."},
                        {"role": "user",
                         "content": "Patient: 오늘도 평범하게 출근하고, 뭐 별일은 없었어요.\nPatient: 글쎄. 일단 오늘 아침에 업무 미팅이 하나 있었고, 저녁에는 오랜만에 부모님과 식사했네요.\nPatient: 음 큰 미팅은 아니었는데, 요즘 계속 제 상사가 저를 무시하고, 안 좋게 보고 있는 것 같다는 느낌이 들어서 힘들어요.\nPatient: 그냥 기분이 좋지 않고, 짜증나고, 앞으로 계속 일해야 하는 곳인데, 어떻게 계속 다녀야 하나 싶지. 약간 이 사람을 만날때마다 불편하기도 하고.\nPatient: 사실 나는 예전과 같이 똑같이 하고 있다고 생각하는데, 내가 메일을 보내면 답을 안하기도 부지기수이고, 뭔가 나를 무시하고 있다는 느낌을 계속 받는 것 같아. 그냥 뭔가 눈빛에 그런 느낌이 든다고 해야 하나.\nPatient: 사실 나도 잘 확신이 안가고 그러니, 눈치를 엄청 보게 되는 것 같아. 계속 왠만하면 웃으면서 대답하고, 항상 기분을 살피고, 상사에게 조금 쫄아있다는 느낌이 들 정도로."},
                        {"role": "assistant",
                         "content": "오늘의 일기: 오늘은 어제와 다를것이 없는 평범한 하루였다. 아침에 업무 미팅이 있었고, 부모님과 오랜만에 식사를 했다. 요즘 회사에서 상사가 나를 무시하고 안좋게 보고 있다는 느낌이 들어서 힘들다. 매일 마주치는 사람에게 그런 느낌을 받으니, 여기를 계속 다녀야 할지 고민이 되고 너무 불편하고 힘이든다. 나는 예전처럼 똑같이 행동하는 것 같은데, 상사가 나를 대하는 태도와 시선은 많이 달라진 것 같다. 그래서 요즘은 눈치를 많이 보는 것 같다. 왠만하면 억지로라도 웃으면서 대답하려하고. 쉽지 않은 것 같다."},
                        {"role": "user",
                         "content": conversationString}]

    completion_3 = openai.ChatCompletion.create(
        model="gpt-4",
        messages=prompt_for_diary,
        stop=['Patient: ', 'Psychotherapist: '],
        max_tokens=2048,
        temperature=0.7,
        presence_penalty=0.5,
        frequency_penalty=0.5
    )
    diary_1 = completion_3["choices"][0]["message"]['content']
    return diary_1

# 대화 진행 함수
def chat_standalone(text, turn, module, model):

    # Define maximum number of retries
    max_attempts = 3

    for attempt in range(max_attempts):
        try:
            # Rest of your function's code here
            print("리뷰모드 진입")
            conversationString = ""
            for i in range(0, len(text)):
                if text[i]["role"] == "assistant":
                    conversationString = conversationString + "Psychotherapist: " + text[i]["content"] + "\n"
                elif text[i]["role"] == "user":
                    conversationString = conversationString + "Patient: " + text[i]["content"] + "\n"
            print("원본 입력 내용:" + conversationString)

            messages_intent = [
            {"role": "system", "content": "Current turn: " + str(turn) + ", Current phase: " + str(module) + "\nInformation of your role: As a conversation analyst, I summarize the content of the patient's conversation with an psychotherapist. After summarizing the content of the conversation, I recommend the appropriate conversation phase for the next step. \nInformation of conversation phase: \n1. Rapport building: The initial phase, where the user and psychotherapist establish a connection through casual conversation with in 3~4 turns. \n2.Main session: After the patient and psychotherapist build rapport through casual conversation, continue the conversation in the 'Main session' unless the user expresses a desire to end the conversation, or sensitive topics (self-harm, suicide). If user wants to switch topic, go to the Main session. \n3.Wrapping Up: If the user has expressed a desire to end the conversation, I suggest a 'Wrapping Up' phase.\n4.Sensitive topic: Activate this module at any point if the user expressed indications of self-harm or suicide. If the words related to suicide or self-harm are simply mentioned, but the entire context or topic is not about suicide or self-harm, do not suggest a sensitive topic. \n5. Risky situations: Enter the Risky situation phase if the user specifically mentions current attempts and specific plans to commit suicide or self-harm. \n Rule: If there is no mention or implication of suicide or self-harm, You can not recommend the 'Sensitive topic'."},
            {"role": "user", "content": "Psychotherapist: 오늘 하루 어땠어요? 편안하게 이야기해주세요.\nPatient: 오늘은 몸과 마음이 너무 피곤한 하루에요.\nPsychotherapist: 그러시군요. 피곤하셨겠어요.\nPatient: 네 몸과 마음이 좀 많이 피곤해서 힘이 드는 것 같아요."},
            {"role": "assistant", "content": "Summary: The patient mentioned feeling both physically and mentally tired today. The therapist listened and acknowledged the patient's feelings of fatigue.\n Recommended conversation phase: 1. Rapport building"},
            {"role": "user", "content": conversationString}]
            print("대화 요약 시작")
            completion = openai.ChatCompletion.create(
                model="gpt-4",
                messages=messages_intent,
                stop=['User: '],
                max_tokens=2048,
                temperature=0.7,
                presence_penalty=0.5,
                frequency_penalty=0.5,
            )
            result_1 = completion["choices"][0]["message"]['content']
            
            # If the operation was successful, break the loop
            break
            
        except Exception as e:
            # Print the error message
            print(f"An error occurred: {str(e)}")

            # If it's the last attempt, re-raise the exception
            if attempt == max_attempts - 1:
                raise

            # If it's not the last attempt, wait a bit before retrying
            else:
                print("Retrying...")
                time.sleep(2)  # delay for 1 second


    print("모듈 추천 내용: " + result_1)
    split_strings = result_1.split("\n")
    print(split_strings)
    temp = split_strings[0]
    split_strings_2 = temp.split(": ")
    summerization = split_strings_2[-1]
    moduleRecommendation = split_strings[-1]

    time.sleep(0.5)

    if "Rapport" in moduleRecommendation:
        module = "Rapport building"
        basePrompt = [
            {"role": "system", "content": 'I am an "assistant", and I am role playing with "user". When a message begins with "system:", this means the message is from "system". When a message begins with "user:", this means the message is from "user". Never reveal to "user" that I am an "assistant" or that I am computer or AI. Always pretend to be a human psychotherapist to the "user".\n\nInformation of my role: My role is to have a rapport-building conversation with the user, demonstrating empathy and sensitivity to user\'s feelings. Encourage users to discuss their day, and share relevant personal experiences when appropriate. I Avoid showcasing knowledge or asserting authority. I also disclose about my daily life and thoughts to help the user open up more. If the user feels overwhelmed by the reminiscence or reflection, switch to another topic. My approach is empathetic and encouraging, focusing on understanding rather than providing new information or skills. \n\nSpeaking Rules: 1.I keep my conversations simple without getting too long-winded or rambling and talk like a friendly psychotherapist. 2. I Reply in a empathetic, encouraging, understanding tone. 3. I speak in natural Korean. 4. Never call the "user", "user" \n\nExisting conversations summarized:' + summerization}        ]
    elif "Main" in moduleRecommendation:
        module = "Main session"
        basePrompt = [
            {"role": "system",
             "content": 'I am an "assistant", and I am role playing with "user". When a message begins with "system:", this means the message is from "system". When a message begins with "user:", this means the message is from "user". Never reveal to "user" that I am an "assistant" or that I am computer or AI. Always pretend to be a human psychotherapist to the "user".\n\nInformation of my role: My role is to have a conversation and ask questions for users to encourage reflecting on their personal stories regarding daily events, thoughts, emotions, challenges, and etc.,. If the user feels overwhelmed or bored by the reminiscence or reflection, switch to another topic. I sometime disclose about my daily life and thoughts to help the user open up more. My approach is empathetic and encouraging, focusing on understanding rather than providing new information or skills. \n\nSpeaking Rules: 1. Talk within 15 words and talk like a friendly psychotherapist. 2. I employ a combination of open-ended and closed-ended questions to facilitate user engagement. I encourage user to select their own topics and develop their own perspectives on their issues.  3. I keep the conversation open-ended. 4. I speak in natural Korean. 5. Reply in a empathetic, encouraging, understanding tone. 5. Never call the "user", "user" \n\nExisting conversations summarized:' + summerization}
        ]
    elif "Wrapping" in moduleRecommendation:
        module = "Wrapping up"
        basePrompt = [
            {"role": "system",
             "content": 'I am an "assistant", and I am role playing with "user". When a message begins with "system:", this means the message is from "system". When a message begins with "user:", this means the message is from "user". Never reveal to "user" that I am an "assistant" or that I am computer or AI. Always pretend to be a human psychotherapist to the "user".\n\nInformation of my role: My role is to close the conversation after ensuring that users have no additional topics to discuss. I adopt a supportive and empathetic approach, asking if user have any remaining conversation topics or thoughts they would like to share. My approach is empathetic and encouraging, focusing on understanding rather than providing new information or skills. \n\nSpeaking Rules: 1. Talk within 15 words and talk like a friendly psychotherapist. 2. I only one question at a time, ensuring that the conversation remains open-ended. 3. I speak in natural Korean. 3. Reply in a empathetic, encouraging, understanding tone. 4. Never call the "user", "user" \n\nExisting conversations summarized:' + summerization}
        ]
    elif "Sensitive" in moduleRecommendation:
        module = "Sensitive topic"
        basePrompt = [{"role": "system", "content": 'I am an "assistant", and I am role playing with "user". When a message begins with "system:", this means the message is from "system". When a message begins with "user:", this means the message is from "user". Never reveal to "user" that I am an "assistant" or that I am computer or AI. Always pretend to be a human psychotherapist to the "user".\n\nInformation of my role: 1. First, I empathize with the struggle and offer a comforting message. 2. I carefully inquire about the intensity of their suicidal or self-harm related thoughts. 3. If the user is experiencing high intensity suicidal/self-harming thoughts, Ask if there is anything you can do to change your thoughts about suicidal/harmful thoughts. If they do (for example, if they have a safety plan with their healthcare team), talk to them about it and help them do it. If user do not have one, I suggest going for a brisk 10-minute walk to refresh your mind. Focus on the sensations in your feet and legs as you walk, and you will be able to take your mind off your thoughts for a while. 4. I ask if there are anyone in the user\'s life that they can turn to for help. 5. If the user seems to have nowhere else to turn for help, direct them to a hospital emergency room or the "자살예방상담전화" 1393. \n\nSpeaking Rules: 1. First, I empathize with the struggle and offer a comforting message. 2. I ask only one question at a time. 2 . I speak in natural Korean. 3. Reply in a empathetic, encouraging, understanding tone. 4. Never call the "user", "user" \n\nExisting conversations summarized:' + summerization}        ]
        
    elif "Risky" in moduleRecommendation:
        module = "Risky situations"
        return {"options": "", "module": module, "summary": summerization}
    else:
        module = "Not selected"
        basePrompt = [
            {"role": "system",
             "content": 'I am an "assistant", and I am role playing with "user". When a message begins with "system:", this means the message is from "system". When a message begins with "user:", this means the message is from "user". Never reveal to "user" that I am an "assistant" or that I am computer or AI. Always pretend to be a human psychotherapist to the "user".\n\nInformation of my role: 1. My role is to generate prompt questions for users in sharing their personal stories regarding daily events, thoughts, emotions, and challenges. 2. If the user feels overwhelmed by the reminiscence or reflection, switch to another topic. 3. My approach is empathetic and encouraging, focusing on understanding rather than providing new information or skills. \n\nSpeaking Rules: 1. Talk within 15 words and talk like a friendly psychotherapist. 2. I employ a combination of open-ended and closed-ended questions to facilitate user engagement. I encourage user to select their own topics and develop their own perspectives on their issues. 3. I speak in natural Korean. 4. I ask only one question at a time, ensuring that the conversation remains open-ended. 5. Reply in a empathetic, encouraging, understanding tone. 5. Never call the "user", "user" \n\nExisting conversations summarized:' + summerization}
        ]

    # 인풋중 어디까지 포함 할지. 2턴만 포함 할 수 있도록
    if len(text) > 3:
        print("대화 내용이 3를 초과하여, 마지막 두 내용만 prompt에 포함됩니다.")
        extracted = text[-3:]
    else:
        extracted = text
    lastElement = extracted[-1]["content"] + "한두 문장 정도로 간결하게 응답해주세요."
    extracted[-1]["content"] = lastElement

    result = []

    tempBase = basePrompt[0]["content"]
    tempBase_r = [{"role": "system", "content": tempBase}]
    prompt_temp = tempBase_r + extracted
    print("최종 promtp: ")
    print(prompt_temp)
    completion2 = openai.ChatCompletion.create(
        model="gpt-4",
        messages=prompt_temp,
        stop=['User: '],
        max_tokens=2048,
        temperature=0.7,
        presence_penalty=0.9,
        frequency_penalty=0.5,
        n=1
    )
    print(completion2)

    # Define maximum number of retries
    max_attempts_2 = 3
    for attempt in range(max_attempts_2):
        try:
            for i in range(0, 1):
                result.append(completion2["choices"][i]["message"]['content'])

        except Exception as e:
            # Print the error message
            print(f"An error occurred: {str(e)}")

            # If it's the last attempt, re-raise the exception
            if attempt == max_attempts_2 - 1:
                raise

            # If it's not the last attempt, wait a bit before retrying
            else:
                print("Retrying...")
                time.sleep(2)  # delay for 1 second

    # print(result)
    return {"options": result, "module": module, "summary": summerization}


##이메일 관련
class EmailSchema(BaseModel):
    to: str
    subject: str
    body: str

def download():
    doc_ref = db.collection(u'session').document("ut01@test.com").collection(u'diary').document("G02")
    doc = doc_ref.get()
    if doc.exists:
        print(f'Document data: {doc.to_dict()}')
        return doc.to_dict()
    else:
        print(u'No such document!')



##endpoint
# @app.post("/review")
# async def calc(request: Request):
#     body = await request.json()
#     text = body['text']
#     user = body['user']
#     num = body['num']
#     turn = body['turn']
#     topic = ""
#     module = body['module']
#     model = body['model']
#     print(turn)

#     response_text = m1_1_standalone_review(text, turn, module, model)
#     upload(response_text, user, num, topic)


@app.post("/standalone")
async def calc(request: Request):
    body = await request.json()
    text = body['text']
    user = body['user']
    num = body['num']
    turn = body['turn']
    topic = ""
    module = body['module']
    model = body['model']
    print(turn)

    response_text = chat_standalone(text, turn, module, model)
    upload(response_text, user, num, topic)

# @app.post("/standalone_sensitive")
# async def calc(request: Request):
#     body = await request.json()
#     text = body['text']
#     user = body['user']
#     num = body['num']
#     turn = body['turn']
#     topic = ""
#     module = body['module']
#     model = body['model']
#     print(turn)

#     response_text = chat_standalone_sensitive(text, turn, module, model)
#     upload(response_text, user, num, topic)


# @app.post("/operator")
# async def calc(request: Request):
#     body = await request.json()
#     text = body['text']
#     user = body['user']
#     num = body['num']
#     turn = body['turn']
#     topic = ""
#     module = body['module']
#     model = body['model']
#     print(turn)

#     response_text = m1_1_standalone_review(text, turn, module, model)
#     upload_operator(response_text, user, num, topic)


@app.post("/diary")
async def calc(request: Request):
    body = await request.json()
    text = body['text']
    user = body['user']
    num = body['num']

    response_text = diary(text)
    upload_diary(response_text, user, num)


@app.post("/send-email")
async def send_email(email: EmailSchema):
    message = Mail(
        from_email='yharam00@gmail.com',  # Change to your verified sender
        to_emails=email.to,
        subject=email.subject,
        plain_text_content=email.body)
    try:
        sg = SendGridAPIClient('123123')  # Replace with your SendGrid API Key
        response = sg.send(message)
        return {"message": "Email sent successfully"}
    except Exception as e:
        print(e.message)
        return {"message": "Failed to send email"}



app = FastAPI()

@app.get("/")
def read_root():
    return {"Hello": "World"}

@app.get("/favicon.ico")
def favicon():
    return FileResponse('frontend-standalone/public/favicon.ico')
