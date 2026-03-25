import sys
from collections import deque
import threading

class TerminalLogCapture:
    def __init__(self, maxlen=50):
        self.logs = deque(maxlen=maxlen)
        self.current_line = ""
        self.original_stdout = sys.stdout
        self.original_stderr = sys.stderr
        self.lock = threading.Lock()

    def start(self):
        sys.stdout = self
        sys.stderr = self

    def isatty(self):
        # Prevent crash when libraries (like transformers) check for terminal colors
        return getattr(self.original_stdout, 'isatty', lambda: False)()

    def fileno(self):
        return getattr(self.original_stdout, 'fileno', lambda: -1)()

    def clear(self):
        with self.lock:
            self.logs.clear()
            self.current_line = ""

    def write(self, text):
        with self.lock:
            # Always pass through to real console
            self.original_stdout.write(text)
            self.original_stdout.flush()

            # Process stream
            for char in text:
                if char == '\n':
                    if self.current_line.strip():
                        self.logs.append(self.current_line)
                    self.current_line = ""
                elif char == '\r':
                    # Carriage return (used by tqdm progress bars)
                    # We store the completed line but replace it on the next write
                    if self.current_line.strip():
                        # If the last item is a progress bar update and we get \r, replace it
                        # For simplicity visually, just set current line to empty, 
                        # but before doing that, let's append it so we can see it. 
                        # Actually a true terminal overwrites. We will just keep the most recent progress state.
                        self.logs.append(self.current_line)
                    self.current_line = ""
                else:
                    self.current_line += char

    def flush(self):
        self.original_stdout.flush()

    def get_logs(self):
        with self.lock:
            lines = list(self.logs)
            if self.current_line.strip():
                lines.append(self.current_line)
            return lines

terminal_logger = TerminalLogCapture()
