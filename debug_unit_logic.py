
import boto3
import json
from decimal import Decimal

# Helper to handle Decimal serialization
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super(DecimalEncoder, self).default(obj)

def check_user_settings(user_id):
    dynamodb = boto3.resource('dynamodb', region_name='eu-north-1')
    users_table = dynamodb.Table('EcoShower-Users')
    
    print(f"Fetching user: {user_id}")
    try:
        response = users_table.get_item(Key={'user_id': user_id})
        item = response.get('Item')
        
        if not item:
            print("User not found!")
            return

        print("\n--- RAW ITEM DUMP ---")
        print(json.dumps(item, cls=DecimalEncoder, indent=2))
        
        print("\n--- LOGIC CHECK ---")
        system = item.get('system', {})
        print(f"System object type: {type(system)}")
        print(f"System content: {system}")
        
        unit_snake = system.get('temperature_unit')
        unit_camel = system.get('temperatureUnit')
        
        print(f"temperature_unit (snake): '{unit_snake}'")
        print(f"temperatureUnit (camel): '{unit_camel}'")
        
        detected = unit_snake or unit_camel
        print(f"Detected preference: '{detected}'")
        
        if detected == 'fahrenheit':
            print(">>> LOGIC WOULD SUCCEED: Conversion triggered")
        else:
            print(">>> LOGIC WOULD FAIL: No conversion")
            
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    # ID from previous logs
    check_user_settings('10ccf94c-b0e1-7045-a794-b07634b51ee8')
