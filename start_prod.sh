#!/bin/bash

source venv/bin/activate

# 使用多工作进程
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000

deactivate 