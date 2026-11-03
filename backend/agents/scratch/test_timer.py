import time

start = time.time()
time.sleep(0.5)    # pretend a tool takes half a second
end = time.time()

print("latency_ms:", int((end - start) * 1000))