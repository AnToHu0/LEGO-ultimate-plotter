from pybricks.hubs import TechnicHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Port
from pybricks.tools import wait
hub = TechnicHub()
motor_x = Motor(Port.A)
motor_y = Motor(Port.B)

def move(x_speed, y_speed):
    motor_x.dc(x_speed)
    motor_y.dc(y_speed)
    print("OK:MOVE")

def stop_all():
    motor_x.stop()
    motor_y.stop()
    print("OK:STOP_ALL")

