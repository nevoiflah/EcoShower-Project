"""
EcoShower - Process Telemetry Lambda
Handles incoming IoT data and triggers notifications
"""

import json
import boto3
import os
from datetime import datetime
from decimal import Decimal

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
iot_client = boto3.client('iot-data')
sns_client = boto3.client('sns')

# Environment variables
TELEMETRY_TABLE = os.environ.get('TELEMETRY_TABLE', 'EcoShower-Telemetry')
DEVICES_TABLE = os.environ.get('DEVICES_TABLE', 'EcoShower-Devices')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE', 'EcoShower-Sessions')
USERS_TABLE = os.environ.get('USERS_TABLE', 'EcoShower-Users')

# Tables
telemetry_table = dynamodb.Table(TELEMETRY_TABLE)
devices_table = dynamodb.Table(DEVICES_TABLE)
sessions_table = dynamodb.Table(SESSIONS_TABLE)
users_table = dynamodb.Table(USERS_TABLE)

# Water cost per liter (NIS)
WATER_COST_PER_LITER = Decimal('0.008')
# Liters saved per second when circulating
LITERS_PER_SECOND = Decimal('0.2')


def lambda_handler(event, context):
    """
    Main handler for IoT telemetry data
    
    Expected event format from IoT Rule:
    {
        "device_id": "abc123",
        "temperature": 32.5,
        "status": "heating",  # heating, ready, idle
        "timestamp": "2025-12-07T12:00:00Z"
    }
    """
    print(f"Received event: {json.dumps(event)}")
    
    try:
        # Extract data from event
        device_id = event.get('device_id')
        temperature = Decimal(str(event.get('temperature', 0)))
        status = event.get('status', 'unknown')
        timestamp = event.get('timestamp', datetime.utcnow().isoformat())
        
        if not device_id:
            raise ValueError("device_id is required")
        
        # 1. Store telemetry data
        store_telemetry(device_id, temperature, status, timestamp)
        
        # 2. Get device configuration
        device = get_device(device_id)
        if not device:
            print(f"Device {device_id} not found in database")
            return {'statusCode': 404, 'body': 'Device not found'}
        
        target_temp = Decimal(str(device.get('target_temp', 38)))
        user_id = device.get('user_id')
        
        # 3. Update device status
        update_device_status(device_id, status, temperature)
        
        # 4. Check if water is ready
        if status == 'heating' and temperature >= target_temp:
            handle_water_ready(device_id, user_id, device)
        
        # 5. Calculate water saved in current session
        if status == 'heating':
            update_session_savings(device_id)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Telemetry processed successfully',
                'device_id': device_id,
                'temperature': float(temperature),
                'target_temp': float(target_temp),
                'status': status
            })
        }
        
    except Exception as e:
        print(f"Error processing telemetry: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }


def store_telemetry(device_id: str, temperature: Decimal, status: str, timestamp: str):
    """Store telemetry data in DynamoDB"""
    telemetry_table.put_item(
        Item={
            'device_id': device_id,
            'timestamp': timestamp,
            'temperature': temperature,
            'status': status
        }
    )
    print(f"Stored telemetry for device {device_id}: {temperature}°C")


def get_device(device_id: str) -> dict:
    """Get device configuration from DynamoDB"""
    response = devices_table.get_item(
        Key={'device_id': device_id}
    )
    return response.get('Item')


def update_device_status(device_id: str, status: str, temperature: Decimal):
    """Update device's current status and temperature"""
    devices_table.update_item(
        Key={'device_id': device_id},
        UpdateExpression='SET #status = :status, current_temp = :temp, last_seen = :ts',
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={
            ':status': status,
            ':temp': temperature,
            ':ts': datetime.utcnow().isoformat()
        }
    )


def handle_water_ready(device_id: str, user_id: str, device: dict):
    """Handle when water reaches target temperature"""
    print(f"Water ready for device {device_id}!")
    
    # 1. Send command to open valve
    send_device_command(device_id, 'OPEN_VALVE')
    
    # 2. Update device status
    devices_table.update_item(
        Key={'device_id': device_id},
        UpdateExpression='SET #status = :status',
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={':status': 'ready'}
    )
    
    # 3. Send push notification
    target_temp = device.get('target_temp', 38)
    send_notification(
        user_id=user_id,
        title='💧 המים מוכנים!',
        message=f'המים ב{device.get("name", "מקלחת")} הגיעו לטמפרטורה של {target_temp}°C. אפשר להיכנס!',
        notification_type='WATER_READY',
        device_id=device_id
    )
    
    # 4. Finalize session - REMOVED to allow manual stop
    # finalize_session(device_id)


def send_device_command(device_id: str, command: str):
    """Send command to device via IoT Core"""
    topic = f'ecoshower/{device_id}/commands'
    payload = {
        'command': command,
        'timestamp': datetime.utcnow().isoformat()
    }
    
    try:
        iot_client.publish(
            topic=topic,
            qos=1,
            payload=json.dumps(payload)
        )
        print(f"Sent command {command} to device {device_id}")
    except Exception as e:
        print(f"Error sending command: {str(e)}")


def send_notification(user_id: str, title: str, message: str, 
                      notification_type: str, device_id: str):
    """Send push notification via SNS (Private Topic)"""
    try:
        # Get user profile to find their private topic and settings
        user_res = users_table.get_item(Key={'user_id': user_id})
        user = user_res.get('Item')
        
        if not user:
            print(f"User {user_id} not found, cannot send notification")
            return

        topic_arn = user.get('sns_topic_arn')
        
        if not topic_arn:
            # Fallback to global if configured, or just log
            print(f"No private SNS topic for user {user_id}")
            return

        # Check user settings
        settings = user.get('notifications', {})
        if notification_type == 'WATER_READY' and not settings.get('water_ready_alert', True):
            print(f"User {user_id} has disabled water ready alerts. Skipping.")
            return

        # Handle Unit Conversion for Message
        # We parse the message to find the temperature (assuming it's formatted as "... {temp}°C ...")
        # Or better yet, we simply reconstruction the message here if it's 'WATER_READY'
        # The original message passed in is: '... temperature of {target_temp}°C...'
        
        final_message = message
        if notification_type == 'WATER_READY':
            system_settings = user.get('system', {})
            unit = system_settings.get('temperature_unit', 'celsius')
            
            if unit == 'fahrenheit':
                # We need to extract the temp or re-fetch it. 
                # Ideally, handle_water_ready should have passed the temp, but we can get it from the device
                # For safety and cleaner code, let's look up the device again or use what we have.
                # However, this function is generic. 
                # Let's try to extract the number from the message string as a quick fix, 
                # OR (cleaner) – let call site handle it? 
                # The call site `handle_water_ready` didn't check user prefs.
                # So we do it here.
                
                # Check if message contains "°C"
                if "°C" in message:
                    import re
                    # extract numbers
                    match = re.search(r"(\d+(\.\d+)?)°C", message)
                    if match:
                        c_temp = float(match.group(1))
                        f_temp = (c_temp * 9/5) + 32
                        final_message = message.replace(f"{c_temp}°C", f"{f_temp:.1f}°F").replace("C", "F")
                        # Also replace any other "C" if it was just text, but the regex covers the value.
                        # Wait, the replace above might miss if formatting changed.
                        # Ideally, better to reconstruction the message if we had parameters.
                        # But since we don't change message structure often:
                        final_message = message.replace(f"{match.group(1)}°C", f"{round(f_temp, 1)}°F")

        sns_client.publish(
            TopicArn=topic_arn,
            Message=json.dumps({
                'default': final_message,
                'GCM': json.dumps({
                    'notification': {
                        'title': title,
                        'body': final_message
                    },
                    'data': {
                        'type': notification_type,
                        'device_id': device_id,
                        'user_id': user_id
                    }
                })
            }),
            MessageStructure='json',
            MessageAttributes={
                'user_id': {
                    'DataType': 'String',
                    'StringValue': user_id
                }
            }
        )
        print(f"Sent notification to user {user_id} via {topic_arn}")
    except Exception as e:
        print(f"Error sending notification: {str(e)}")


def update_session_savings(device_id: str):
    """Update water saved in current session"""
    # Get current active session
    response = sessions_table.query(
        IndexName='device-index',
        KeyConditionExpression='device_id = :did',
        FilterExpression='#status = :status',
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={
            ':did': device_id,
            ':status': 'active'
        },
        Limit=1,
        ScanIndexForward=False
    )
    
    if response.get('Items'):
        session = response['Items'][0]
        session_id = session['session_id']
        
        # Calculate time elapsed
        start_time = datetime.fromisoformat(session['start_time'].replace('Z', '+00:00'))
        now = datetime.utcnow()
        elapsed_seconds = Decimal(str((now - start_time.replace(tzinfo=None)).total_seconds()))
        
        # Calculate savings
        water_saved = elapsed_seconds * LITERS_PER_SECOND
        money_saved = water_saved * WATER_COST_PER_LITER
        
        sessions_table.update_item(
            Key={'session_id': session_id},
            UpdateExpression='SET water_saved = :water, money_saved = :money',
            ExpressionAttributeValues={
                ':water': water_saved,
                ':money': money_saved
            }
        )


def finalize_session(device_id: str):
    """Finalize the current session"""
    response = sessions_table.query(
        IndexName='device-index',
        KeyConditionExpression='device_id = :did',
        FilterExpression='#status = :status',
        ExpressionAttributeNames={'#status': 'status'},
        ExpressionAttributeValues={
            ':did': device_id,
            ':status': 'active'
        },
        Limit=1,
        ScanIndexForward=False
    )
    
    if response.get('Items'):
        session = response['Items'][0]
        session_id = session['session_id']
        
        sessions_table.update_item(
            Key={'session_id': session_id},
            UpdateExpression='SET #status = :status, end_time = :end',
            ExpressionAttributeNames={'#status': 'status'},
            ExpressionAttributeValues={
                ':status': 'completed',
                ':end': datetime.utcnow().isoformat()
            }
        )
        print(f"Session {session_id} finalized")
