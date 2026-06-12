from microbit import *
import music

# Agent Avatars
AVATAR_IDLE = Image("00900:"
                    "99999:"
                    "90909:"
                    "99999:"
                    "09090")

AVATAR_THINK_1 = AVATAR_IDLE

AVATAR_THINK_2 = Image("00000:"
                       "99999:"
                       "90909:"
                       "99999:"
                       "00000")

AVATAR_SPEAK = Image("90909:"
                     "09090:"
                     "90909:"
                     "09090:"
                     "90909")

# State variables
current_state = "IDLE"
display.show(AVATAR_IDLE)
uart.init(baudrate=115200)

def set_state(state):
    global current_state
    current_state = state
    if state == "IDLE":
        display.show(AVATAR_IDLE)
    elif state == "SPEAK":
        display.show(AVATAR_SPEAK)
        # Speak state returns to IDLE quickly in the web, but here we can just show it
        sleep(200)
        display.show(AVATAR_IDLE)

think_toggle = False
last_think_time = running_time()

while True:
    # 1. Read commands from Web App
    if uart.any():
        command = uart.readline()
        if command:
            try:
                cmd_str = str(command, 'utf-8').strip()
                if cmd_str in ["IDLE", "THINK", "SPEAK"]:
                    set_state(cmd_str)
            except:
                pass

    # 2. Handle State Animations
    if current_state == "THINK":
        if running_time() - last_think_time > 300:
            think_toggle = not think_toggle
            if think_toggle:
                display.show(AVATAR_THINK_2)
            else:
                display.show(AVATAR_THINK_1)
            last_think_time = running_time()

    # 3. Detect Sound / Claps
    if microphone.current_event() == SoundEvent.LOUD:
        uart.write("CLAP\n")
        display.show(Image.SURPRISED)
        sleep(500)
        display.show(AVATAR_IDLE)

    # 4. Handle Button Presses
    if button_a.was_pressed():
        uart.write("BTN_A\n")
        display.show(Image.YES)
        sleep(300)
        set_state(current_state) # return to visual

    if button_b.was_pressed():
        uart.write("BTN_B\n")
        display.show(Image.NO)
        sleep(300)
        set_state(current_state)

    sleep(20)
