from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.logs import router as logs_router
from routers.agent import router as agent_router   # this is the missing line

app = FastAPI()


app.add_middleware(
    CORSMiddleware,
    allow_origins = ["*"],
    allow_credentials = True,
    allow_headers = ["*"],
    allow_methods=["*"],
)

app.include_router(logs_router)
app.include_router(agent_router)