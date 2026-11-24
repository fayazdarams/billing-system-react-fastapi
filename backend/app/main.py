from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import test_connection
from app.routers.auth import router as auth_router
from app.erp.routers.accounts import router as accounts_router


app = FastAPI(title="Billing API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],   # for now allow all, after you have frontend URL, we will lock it down
    allow_origin_regex="https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(accounts_router)

@app.get("/")
def root():
    return {"message": "Billing API is running"}

@app.get("/db-test")
def db_test():
    return {
        "status": "connected",
        "database": test_connection()  # should return "billing_auth"
    }