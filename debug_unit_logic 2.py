
import boto3
import json
from decimal import Decimal

# Setup AWS (uses your local env credentials which worked for CLI)
dynamodb = boto3.resource('dynamodb', region_name='eu-north-1')
users_table = dynamodb.Table('EcoShower-Users')

def debug_user_unit(user_id):
    print(f"--- Debugging User {user_id} ---")
    
    # 1. Fetch User
    response = users_table.get_item(Key={'user_id': user_id})
    if 'Item' not in response:
        print("User not found!")
        return

    user = response['Item']
    print("Full User Object:", user)
    
    # 2. Extract System Settings
    system = user.get('system', {})
    print("System Dict:", system)
    print("System Type:", type(system))
    
    # 3. Check Unit Logic (Exact copy from Lambda)
    unit_pref = system.get('temperature_unit') or system.get('temperatureUnit')
    print(f"Raw unit_pref: '{unit_pref}'")
    print(f"Type of unit_pref: {type(unit_pref)}")
    
    if unit_pref:
        print(f"repr(unit_pref): {repr(unit_pref)}")
        
    # 4. Simulation
    target_temp = 40 # 104F
    temp_display = f"{target_temp}"
    unit_display = "°C"
    
    if unit_pref == 'fahrenheit':
        print("✅ MATCH: 'fahrenheit'")
        c_temp = float(target_temp)
        f_temp = (c_temp * 9/5) + 32
        temp_display = f"{f_temp:.1f}"
        unit_display = "°F"
    else:
        print(f"❌ NO MATCH. '{unit_pref}' != 'fahrenheit'")
        
    print(f"Resulting Display: {temp_display}{unit_display}")

# Run for the specific user we found earlier
debug_user_unit('10ccf94c-b0e1-7045-a794-b07634b51ee8')
