import uvicorn


# if __name__ == "__main__":
#     uvicorn.run("app.restAPI:app", host="0.0.0.0", port=8000, reload=True)
#
# if __name__ == "__main__":
# #     uvicorn.run("app.gpt3_chat:app", host="0.0.0.0", port=8000, reload=True)
#
# if __name__ == "__main__":
#     uvicorn.run("app.api:app", host="0.0.0.0", port=8000, reload=True)

# if __name__ == "__main__":
#     uvicorn.run("app.private_gpt3-chat_direct:app", host="0.0.0.0", port=8000, reload=True)

if __name__ == "__main__":
    uvicorn.run("app.private0426gpt3-chat_direct:app", host="0.0.0.0", port=8000, reload=True)