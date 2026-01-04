"""
EcoShower - API Lambda
Handles all REST API requests for users, devices, and dashboard
"""

import json
import boto3
import os
import uuid
from datetime import datetime, timedelta
from decimal import Decimal
from boto3.dynamodb.conditions import Key

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
iot_client = boto3.client('iot-data')

# Environment variables
USERS_TABLE = os.environ.get('USERS_TABLE', 'EcoShower-Users')
DEVICES_TABLE = os.environ.get('DEVICES_TABLE', 'EcoShower-Devices')
SESSIONS_TABLE = os.environ.get('SESSIONS_TABLE', 'EcoShower-Sessions')
TELEMETRY_TABLE = os.environ.get('TELEMETRY_TABLE', 'EcoShower-Telemetry')


# initialize sns and cognito
sns_client = boto3.client('sns')
cognito_client = boto3.client('cognito-idp')
USER_POOL_ID = os.environ.get('USER_POOL_ID', 'eu-north-1_q1X9yXVs5')


# Tables
users_table = dynamodb.Table(USERS_TABLE)
devices_table = dynamodb.Table(DEVICES_TABLE)
sessions_table = dynamodb.Table(SESSIONS_TABLE)
telemetry_table = dynamodb.Table(TELEMETRY_TABLE)


class DecimalEncoder(json.JSONEncoder):
    """Custom JSON encoder for Decimal types"""
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)
        return super().default(obj)


def response(status_code: int, body: dict) -> dict:
    """Create API Gateway response"""
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
            'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS'
        },
        'body': json.dumps(body, cls=DecimalEncoder, ensure_ascii=False)
    }


def lambda_handler(event, context):
    """Main handler for API requests"""
    try:
        print(f"Received event: {json.dumps(event)}")
        
        # Handle CORS preflight
        if event.get('httpMethod') == 'OPTIONS':
            return response(200, {'message': 'OK'})
        
        # Get request info
        http_method = event.get('httpMethod', '')
        path = event.get('path', '')
        path_params = event.get('pathParameters') or {}
        query_params = event.get('queryStringParameters') or {}
        
        # Parse body if present
        body = {}
        if event.get('body'):
            try:
                body = json.loads(event['body'])
            except json.JSONDecodeError:
                return response(400, {'error': 'Invalid JSON body'})
        
        # Get user info from authorizer
        user_id = None
        user_role = 'user'
        
        auth_context = event.get('requestContext', {}).get('authorizer')
        if auth_context:
            # Standard Cognito Claims
            claims = auth_context.get('claims')
            if claims:
                # Handle stringified claims (rare but possible)
                if isinstance(claims, str):
                    try:
                        claims = json.loads(claims)
                    except:
                        pass
                
                user_id = claims.get('sub')
                if not user_id:
                    # Fallback: Try 'username', 'cognito:username', or 'id'
                    user_id = claims.get('username') or claims.get('cognito:username') or claims.get('id')
                
                # Check for admin role in groups or custom attribute
                groups = claims.get('cognito:groups', [])
                if isinstance(groups, str):
                    try:
                        groups = json.loads(groups) # Handle potential stringified list
                    except:
                        groups = [groups]
                
                if 'admins' in groups or claims.get('custom:role') == 'admin':
                    user_role = 'admin'
                else:
                    user_role = claims.get('custom:role', 'user')
                user_email = claims.get('email')
                user_name = claims.get('name') or claims.get('email', '').split('@')[0]
            else:
                 print(f"DEBUG: Authorizer present but claims missing: {auth_context.keys()}")
        
        # Debug Fallback: If user_id is still None but we are in a device/stop route, dump context
        if user_id is None: 
             # Try to extract from 'identity' (IAM) as last resort
             identity = event.get('requestContext', {}).get('identity', {})
             if identity.get('userArn'):
                 user_id = identity.get('userArn').split(':')[-1] # simplistic

        if user_id is None and ('/devices' in path):
            print(f"DEBUG FAIL: User is None. RequestContext: {json.dumps(event.get('requestContext', {}))}")
            # Note: We continue, but downstream will fail with 403.

        
        # Route the request
        # Device routes
        if path.startswith('/devices'):
            return handle_devices(http_method, path, path_params, body, user_id, user_role)
        
        # Dashboard routes
        elif path.startswith('/dashboard'):
            return handle_dashboard(http_method, path, path_params, query_params, user_id)

        # Session routes
        elif path.startswith('/sessions'):
            if http_method == 'DELETE':
                # DELETE /sessions/{sessionId}
                parts = path.split('/')
                if len(parts) >= 3:
                     # Add extra debug
                     print(f"Routing DELETE session {parts[2]} for user {user_id}")
                     return delete_session(parts[2], user_id)
            return response(405, {'error': 'Method not allowed'})
        
        # User profile routes
        elif path.startswith('/users'):
            return handle_users(http_method, path, path_params, body, user_id, user_role, user_email, user_name)
        
        # Admin routes
        elif path.startswith('/admin'):
            if user_role != 'admin':
                return response(403, {'error': 'Admin access required'})
            return handle_admin(http_method, path, path_params, query_params, body)
        
        # Settings routes
        elif path.startswith('/settings'):
            return handle_settings(http_method, body, user_id)
        
        else:
            return response(404, {'error': 'Route not found'})
            
    except Exception as e:
        print(f"CRITICAL LAMBDA ERROR: {str(e)}")
        # Return 500 with headers to avoid CORS error on client
        return response(500, {'error': f"Internal Server Error: {str(e)}"})


# ============= DEVICES =============

def handle_devices(method: str, path: str, params: dict, body: dict, 
                   user_id: str, role: str) -> dict:
    """Handle device-related requests"""
    device_id = params.get('device_id')
    
    # GET /devices - List user's devices
    if method == 'GET' and not device_id:
        return list_devices(user_id)
    
    # GET /devices/{id} - Get device details
    elif method == 'GET' and device_id:
        return get_device(device_id, user_id, role)
    
    # POST /devices - Add new device
    elif method == 'POST' and not device_id:
        return add_device(body, user_id)
    
    # PUT /devices/{id} - Update device
    elif method == 'PUT' and device_id:
        return update_device(device_id, body, user_id, role)
    
    # DELETE /devices/{id} - Delete device
    elif method == 'DELETE' and device_id:
        return delete_device(device_id, user_id, role)
    
    # POST /devices/{id}/command - Send command
    elif method == 'POST' and '/command' in path:
        return send_command(device_id, body, user_id, role)
    
    # POST /devices/{id}/start - Start shower session
    elif method == 'POST' and '/start' in path:
        return start_session(device_id, body, user_id, role)

    # POST /devices/{id}/stop - Stop shower session
    elif method == 'POST' and '/stop' in path:
        return stop_session(device_id, body, user_id, role)

    # POST /devices/{id}/ready - Mark water as ready (Mock)
    elif method == 'POST' and '/ready' in path:
        return mark_water_ready(device_id, user_id, role)
    
    return response(404, {'error': 'Device route not found'})


# Helper to ensure user has a private topic
def ensure_user_topic(user_id: str, email: str = None) -> str:
    """Create distinct SNS topic for user if needed and return ARN"""
    topic_name = f"EcoShower-User-{user_id.split('-')[-1]}" # Shorten ID for cleaner name
    
    try:
        # Create (or get existing) topic
        response = sns_client.create_topic(Name=topic_name)
        topic_arn = response['TopicArn']
        
        # Subscribe email if provided
        if email:
            # Check if already subscribed? (SNS handles deduplication mostly, but we can just subscribe)
            sns_client.subscribe(
                TopicArn=topic_arn,
                Protocol='email',
                Endpoint=email
            )
            
        print(f"Ensured topic {topic_arn} for user {user_id}")
        return topic_arn
    except Exception as e:
        print(f"Failed to ensure topic: {e}")
        return None


def mark_water_ready(device_id: str, user_id: str, role: str) -> dict:
    """Mark device as ready and send notification"""
    # Check device ownership
    result = devices_table.get_item(Key={'device_id': device_id})
    device = result.get('Item')
    
    if not device:
        return response(404, {'error': 'Device not found'})

    if role != 'admin' and device.get('user_id') != user_id:
        return response(403, {'error': f'Access denied ({user_id})'})
        
    # Update device status
    devices_table.update_item(
        Key={'device_id': device_id},
        UpdateExpression='SET #s = :s',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={':s': 'ready'}
    )
    
    # Send Notification
    try:
        # Get user profile for topic ARN
        owner_id = device.get('user_id')
        user_result = users_table.get_item(Key={'user_id': owner_id})
        user = user_result.get('Item', {})
        
        target_temp = device.get('target_temp', 38)
        
        message = (
            f"Hello {user.get('name', 'User')},\n\n"
            f"Your water is ready! The temperature has reached {target_temp}°C.\n"
            f"You can now start your shower."
        )
        
        # Check settings
        user_settings = user.get('notifications', {})
        should_notify = user_settings.get('water_ready_alert', True)
        if str(should_notify).lower() == 'false':
            should_notify = False
            
        if should_notify:
            # Get or Create Private Topic
            topic_arn = user.get('sns_topic_arn')
            if not topic_arn:
                # Fallback: create it now
                email = user.get('email')
                if email:
                    topic_arn = ensure_user_topic(owner_id, email)
                    # Save to profile
                    if topic_arn:
                        users_table.update_item(
                            Key={'user_id': owner_id},
                            UpdateExpression='SET sns_topic_arn = :arn',
                            ExpressionAttributeValues={':arn': topic_arn}
                        )

            if topic_arn:
                sns_client.publish(
                    TopicArn=topic_arn,
                    Message=message,
                    Subject="EcoShower - Water Ready!"
                )
                print(f"Sent Private SNS to {topic_arn}")
            else:
                print(f"No topic available for user {owner_id}")
        else:
            print(f"Notification skipped for user {owner_id}")
            
    except Exception as e:
        print(f"Failed to send notification: {e}")
    
    return response(200, {'message': 'Water marked as ready'})



def list_devices(user_id: str) -> dict:
    """List all devices for a user with dynamic stats"""
    result = devices_table.query(
        IndexName='user-index',
        KeyConditionExpression=Key('user_id').eq(user_id)
    )
    devices = result.get('Items', [])
    
    # Calculate true stats from sessions table
    for device in devices:
        try:
            device_id = device.get('device_id')
            session_result = sessions_table.query(
                IndexName='device-index',
                KeyConditionExpression=Key('device_id').eq(device_id),
                Select='SPECIFIC_ATTRIBUTES',
                ProjectionExpression='water_saved'
            )
            
            sessions = session_result.get('Items', [])
            count = len(sessions)
            total_water = sum(Decimal(str(s.get('water_saved', 0))) for s in sessions)
            
            # Override stored values with calculated ones
            device['total_sessions'] = count
            device['total_water_saved'] = total_water
            
        except Exception as e:
            print(f"Error calculating stats for device {device.get('device_id')}: {e}")
            # Fallback to stored values if calculation fails
            pass

    return response(200, {'devices': devices})


def get_device(device_id: str, user_id: str, role: str) -> dict:
    """Get device details"""
    result = devices_table.get_item(Key={'device_id': device_id})
    device = result.get('Item')
    
    if not device:
        return response(404, {'error': 'Device not found'})
    
    # Check ownership (unless admin)
    if role != 'admin' and device.get('user_id') != user_id:
        return response(403, {'error': 'Access denied'})
    
    return response(200, {'device': device})


def add_device(body: dict, user_id: str) -> dict:
    """Add a new device"""
    # Validate required fields
    name = body.get('name')
    device_code = body.get('device_code')
    
    if not name or not device_code:
        return response(400, {'error': 'name and device_code are required'})
    
    # Validate device code length
    if len(device_code) != 12:
        return response(400, {'error': 'Invalid device code format'})
    
    # TODO: Verify device_code exists in IoT Core
    
    device_id = str(uuid.uuid4())
    device = {
        'device_id': device_id,
        'user_id': user_id,
        'name': name,
        'device_code': device_code,
        'target_temp': Decimal(str(body.get('target_temp', 38))),
        'status': 'ready',
        'current_temp': Decimal('0'),
        'created_at': datetime.utcnow().isoformat(),
        'last_seen': None
    }
    
    devices_table.put_item(Item=device)
    return response(210, {'device': device})


def update_device(device_id: str, body: dict, user_id: str, role: str) -> dict:
    """Update device settings"""
    # Check ownership
    result = devices_table.get_item(Key={'device_id': device_id})
    device = result.get('Item')
    
    if not device:
        return response(404, {'error': 'Device not found'})
    
    if role != 'admin' and device.get('user_id') != user_id:
        return response(403, {'error': 'Access denied'})
    
    # Build update expression
    update_expr = 'SET updated_at = :updated'
    expr_values = {':updated': datetime.utcnow().isoformat()}
    expr_names = {}
    
    if 'name' in body:
        update_expr += ', #name = :name'
        expr_values[':name'] = body['name']
        expr_names['#name'] = 'name'
        
    if 'status' in body:
        update_expr += ', #status = :status'
        expr_values[':status'] = body['status']
        expr_names['#status'] = 'status'
    
    if 'target_temp' in body:
        temp = body['target_temp']
        if not (30 <= temp <= 45):
            return response(400, {'error': 'Temperature must be 30-45°C'})
        update_expr += ', target_temp = :temp'
        expr_values[':temp'] = Decimal(str(temp))
    
    
    
    update_kwargs = {
        'Key': {'device_id': device_id},
        'UpdateExpression': update_expr,
        'ExpressionAttributeValues': expr_values,
        'ReturnValues': 'UPDATED_NEW'
    }
    
    if expr_names:
        update_kwargs['ExpressionAttributeNames'] = expr_names
    
    devices_table.update_item(**update_kwargs)

    
    return response(200, {'message': 'Device updated'})


def delete_device(device_id: str, user_id: str, role: str) -> dict:
    """Delete a device"""
    result = devices_table.get_item(Key={'device_id': device_id})
    device = result.get('Item')
    
    if not device:
        return response(404, {'error': 'Device not found'})
    
    if role != 'admin' and device.get('user_id') != user_id:
        return response(403, {'error': 'Access denied'})
    
    try:
        # Delete all sessions associated with this device first
        session_response = sessions_table.query(
            IndexName='device-index',
            KeyConditionExpression=Key('device_id').eq(device_id)
        )
        
        for session in session_response.get('Items', []):
            try:
                sessions_table.delete_item(Key={'session_id': session['session_id']})
                print(f"Deleted cascaded session {session['session_id']}")
            except Exception as e:
                print(f"Failed to delete session {session.get('session_id')}: {e}")
                
        # Now delete the device
        devices_table.delete_item(Key={'device_id': device_id})
        return response(200, {'message': 'Device and history deleted'})
        
    except Exception as e:
        print(f"Error deleting device: {e}")
        return response(500, {'error': 'Failed to delete device'})


def send_command(device_id: str, body: dict, user_id: str, role: str) -> dict:
    """Send command to device"""
    command = body.get('command')
    if not command:
        return response(400, {'error': 'command is required'})
    
    valid_commands = ['START_HEATING', 'STOP_HEATING', 'OPEN_VALVE', 'CLOSE_VALVE']
    if command not in valid_commands:
        return response(400, {'error': f'Invalid command. Valid: {valid_commands}'})
    
    # Check ownership
    result = devices_table.get_item(Key={'device_id': device_id})
    device = result.get('Item')
    
    if not device:
        return response(404, {'error': 'Device not found'})
    
    if role != 'admin' and device.get('user_id') != user_id:
        return response(403, {'error': 'Access denied'})
    
    # Publish to IoT
    topic = f'ecoshower/{device_id}/commands'
    payload = {
        'command': command,
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }
    
    iot_client.publish(
        topic=topic,
        qos=1,
        payload=json.dumps(payload)
    )
    
    # If stopping heating, sync DB status
    if command == 'STOP_HEATING':
        try:
            devices_table.update_item(
                Key={'device_id': device_id},
                UpdateExpression='SET #s = :r',
                ExpressionAttributeNames={'#s': 'status'},
                ExpressionAttributeValues={':r': 'ready'}
            )
        except Exception as e:
            print(f"Failed to sync STOP_HEATING to DB: {e}")
    
    return response(200, {'message': f'Command {command} sent'})


def start_session(device_id: str, body: dict, user_id: str, role: str = 'user') -> dict:
    """Start a new shower session"""
    # Check device ownership
    result = devices_table.get_item(Key={'device_id': device_id})
    device = result.get('Item')
    
    if not device:
         return response(404, {'error': 'Device not found'})

    if role != 'admin' and device.get('user_id') != user_id:
        return response(403, {'error': f'Access denied. User: {user_id}, Owner: {device.get("user_id")}'})
    
    # Create session
    session_id = str(uuid.uuid4())
    target_temp = Decimal(str(body.get('target_temp', device.get('target_temp', 38))))
    planned_duration = int(body.get('duration', 10))
    
    session = {
        'session_id': session_id,
        'device_id': device_id,
        'device_name': device.get('name', 'Unknown Device'),
        'user_id': user_id,
        'start_time': datetime.utcnow().isoformat() + 'Z',
        'status': 'active',
        'target_temp': target_temp,
        'planned_duration': planned_duration,
        'water_saved': Decimal('0'),
        'money_saved': Decimal('0')
    }
    
    sessions_table.put_item(Item=session)
    
    # Update device target temp and status
    devices_table.update_item(
        Key={'device_id': device_id},
        UpdateExpression='SET target_temp = :t, #s = :s',
        ExpressionAttributeNames={'#s': 'status'},
        ExpressionAttributeValues={
            ':t': target_temp,
            ':s': 'heating'
        }
    )
    
    # Send start command
    send_command(device_id, {'command': 'START_HEATING'}, user_id, role)
    
    return response(210, {'session': session})


def stop_session(device_id: str, body: dict, user_id: str, role: str = 'user') -> dict:
    """Stop the current shower session"""
    # Check device ownership
    result = devices_table.get_item(Key={'device_id': device_id})
    device = result.get('Item')
    
    if not device:
        return response(404, {'error': 'Device not found'})

    if role != 'admin' and device.get('user_id') != user_id:
        return response(403, {'error': f'Access denied. User: {user_id}, Owner: {device.get("user_id")}'})
        
    # Try direct session update if ID provided (Strongly Consistent)
    session_id = body.get('session_id')
    active_session = None
    
    if session_id:
        print(f"Stopping session by ID: {session_id}")
        try:
            result = sessions_table.get_item(Key={'session_id': session_id})
            item = result.get('Item')
            if item and item.get('status') == 'active':
                active_session = item
        except Exception as e:
            print(f"Error fetching session by ID: {e}")

    # Fallback to GSI query (Eventual Consistency)
    if not active_session:
        print("Fallback to GSI query for active session")
        response_scan = sessions_table.query(
            IndexName='device-index',
            KeyConditionExpression=Key('device_id').eq(device_id),
            FilterExpression=Key('status').eq('active'),
            Limit=5,
            ScanIndexForward=False
        )
        if response_scan.get('Items'):
             active_session = response_scan['Items'][0]

    # Fallback to Full Table Scan (Ultimate consistency check)
    if not active_session:
        print("Fallback to Full Table Scan for active session")
        scan_response = sessions_table.scan(
             FilterExpression=Key('device_id').eq(device_id) & Key('status').eq('active')
        )
        if scan_response.get('Items'):
             active_session = scan_response['Items'][0]

    if not active_session:
        # Just stop heating if no session found
        send_command(device_id, {'command': 'STOP_HEATING'}, user_id, role)
        return response(200, {
            'message': 'Heating stopped (no active session found)',
            'debug_session_id_provided': session_id,
            'debug_gsi_fallback': True
        })
        
    # Calculate final stats
    final_duration = body.get('duration')
    
    # Use the trusted duration from frontend if available
    if final_duration is not None:
        elapsed_seconds = Decimal(str(final_duration))
    else:
        # Fallback calculation
        start_time = datetime.fromisoformat(str(active_session['start_time']).replace('Z', '+00:00'))
        now = datetime.utcnow()
        if start_time.tzinfo is not None:
            start_time = start_time.replace(tzinfo=None)
        elapsed_seconds = Decimal(str((now - start_time).total_seconds()))
    
    # Constants
    WATER_COST_PER_LITER = Decimal('0.008')
    LITERS_PER_SECOND = Decimal('0.8')  # Updated to 0.8L/s (Water Used)
    
    # We store "water used" in the 'water_saved' column for schema compatibility
    water_used = elapsed_seconds * LITERS_PER_SECOND
    money_saved = water_used * WATER_COST_PER_LITER
    
    # Update session
    sessions_table.update_item(
        Key={'session_id': active_session['session_id']},
        UpdateExpression='SET #status = :status, end_time = :end, water_saved = :water, money_saved = :money, #d = :duration',
        ExpressionAttributeNames={'#status': 'status', '#d': 'duration'},
        ExpressionAttributeValues={
            ':status': 'completed',
            ':end': datetime.utcnow().isoformat() + 'Z',
            ':water': water_used,
            ':money': money_saved,
            ':duration': elapsed_seconds
        }
    )
    
    # Update device totals
    try:
        devices_table.update_item(
            Key={'device_id': device_id},
            UpdateExpression='SET #s = :r ADD total_water_saved :w, total_sessions :i',
            ExpressionAttributeNames={'#s': 'status'},
            ExpressionAttributeValues={
                ':w': water_used,
                ':i': 1,
                ':r': 'ready'
            }
        )
    except Exception as e:
        print(f"Failed to update device stats: {e}")
    
    # Send stop command
    send_command(device_id, {'command': 'STOP_HEATING'}, user_id, 'user')
    
    return response(200, {
        'message': 'Session stopped',
        'water_saved': float(water_used),
        'money_saved': float(money_saved),
        'duration_seconds': float(elapsed_seconds),
        'debug_session_id': session_id,
        'debug_found_active': active_session is not None,
        'debug_start_time': active_session.get('start_time') if active_session else None
    })


# ============= DASHBOARD =============

def handle_dashboard(method: str, path: str, params: dict, 
                     query: dict, user_id: str) -> dict:
    """Handle dashboard requests"""
    
    if '/summary' in path:
        return get_summary(user_id)
    
    elif '/history' in path:
        try:
            limit = int(query.get('limit', 50))
        except (ValueError, TypeError):
            print(f"Invalid limit parameter: {query.get('limit')}, defaulting to 50")
            limit = 50
        return get_history(user_id, limit)
    
    elif '/realtime' in path:
        device_id = params.get('device_id')
        return get_realtime(device_id, user_id)
    
    return response(404, {'error': 'Dashboard route not found'})


def get_summary(user_id: str) -> dict:
    """Get dashboard summary for user"""
    # Get user's devices
    devices_result = devices_table.query(
        IndexName='user-index',
        KeyConditionExpression=Key('user_id').eq(user_id)
    )
    device_ids = [d['device_id'] for d in devices_result.get('Items', [])]
    
    if not device_ids:
        return response(200, {
            'total_water_saved': 0,
            'total_money_saved': 0,
            'sessions_count': 0,
            'avg_per_session': 0
        })
    
    # Get all-time sessions
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0).isoformat()
    
    total_water = Decimal('0')
    total_money = Decimal('0')
    today_usage = Decimal('0')
    session_count = 0
    
    for device_id in device_ids:
        # Fetch all sessions for device
        result = sessions_table.query(
            IndexName='device-index',
            KeyConditionExpression=Key('device_id').eq(device_id)
        )
        
        for session in result.get('Items', []):
            if session.get('status') == 'completed':
                # Global Totals (All Time)
                session_count += 1
                total_water += session.get('water_saved', Decimal('0'))
                total_money += session.get('money_saved', Decimal('0'))
                
                start_time = session.get('start_time', '')
                if start_time >= today_start:
                    today_usage += session.get('water_saved', Decimal('0'))
                    
    avg_per_session = total_water / session_count if session_count > 0 else Decimal('0')
    
    return response(200, {
        'total_water_saved': float(total_water),
        'total_money_saved': float(total_money),
        'sessions_count': session_count,
        'avg_per_session': float(avg_per_session),
        'today_usage': float(today_usage),
        'period': 'all_time'
    })


def get_history(user_id: str, limit: int) -> dict:
    """Get session history for user"""
    # Get user's devices
    devices_result = devices_table.query(
        IndexName='user-index',
        KeyConditionExpression=Key('user_id').eq(user_id)
    )
    devices = devices_result.get('Items', [])
    device_map = {d['device_id']: d.get('name', 'Unknown Device') for d in devices}
    device_ids = list(device_map.keys())
    
    sessions = []
    for device_id in device_ids:
        result = sessions_table.query(
            IndexName='device-index',
            KeyConditionExpression=Key('device_id').eq(device_id),
            ScanIndexForward=False,
            Limit=limit
        )
        for session in result.get('Items', []):
            if 'device_name' not in session:
                session['device_name'] = device_map.get(session['device_id'], 'Unknown Device')
            sessions.append(session)
    
    # Sort by start_time descending
    sessions.sort(key=lambda x: x.get('start_time', ''), reverse=True)
    
    return response(200, {'sessions': sessions[:limit]})


def get_realtime(device_id: str, user_id: str) -> dict:
    """Get real-time telemetry for device"""
    # Check ownership
    result = devices_table.get_item(Key={'device_id': device_id})
    device = result.get('Item')
    
    if not device or device.get('user_id') != user_id:
        return response(403, {'error': 'Access denied'})
    
    # Get latest telemetry (last 5 minutes)
    five_min_ago = (datetime.utcnow() - timedelta(minutes=5)).isoformat()
    
    result = telemetry_table.query(
        KeyConditionExpression=Key('device_id').eq(device_id) & 
                               Key('timestamp').gte(five_min_ago),
        ScanIndexForward=False,
        Limit=10
    )
    
    return response(200, {
        'device': device,
        'telemetry': result.get('Items', [])
    })


# ============= USERS =============

def handle_users(method: str, path: str, params: dict, body: dict,
                 user_id: str, role: str, email: str = None, name: str = None) -> dict:
    """Handle user-related requests"""
    target_user_id = params.get('user_id')
    
    # GET /users/me - Get own profile
    if method == 'GET' and (not target_user_id or target_user_id == 'me'):
        return get_user_profile(user_id, email, name)
    
    # PUT /users/me - Update own profile
    elif method == 'PUT' and (not target_user_id or target_user_id == 'me'):
        return update_user_profile(user_id, body)
    
    # Admin: GET /users - List all users
    elif method == 'GET' and not target_user_id and role == 'admin':
        return list_all_users()
    
    return response(404, {'error': 'User route not found'})


def get_user_profile(user_id: str, email: str = None, name: str = None) -> dict:
    """Get user profile"""
    result = users_table.get_item(Key={'user_id': user_id})
    user = result.get('Item')
    
    # Auto-create user if missing (self-healing for existing Cognito users)
    if not user and email:
        print(f"User {user_id} not found in DB, creating from Cognito claims...")
        created_at = datetime.utcnow().isoformat()
        user = {
            'user_id': user_id,
            'email': email,
            'name': name or email.split('@')[0],
            'role': 'user',
            'created_at': created_at,
            'updated_at': created_at,
            'notifications': {
                'water_ready_alert': True
            },
            'system': {
                'temperature_unit': 'celsius',
                'water_price_per_liter': Decimal('0.008'),
                'language': 'he'
            }
        }
        try:
            # Add SNS Subscription (Private Topic)
            if email:
                try:
                    topic_arn = ensure_user_topic(user_id, email)
                    if topic_arn:
                        user['sns_topic_arn'] = topic_arn
                except Exception as e:
                    print(f"SNS Auto-Subscribe failed: {e}")

            users_table.put_item(Item=user)
        except Exception as e:
            print(f"Failed to auto-create user: {e}")
            return response(500, {'error': 'Failed to create user record'})
            
    if not user:
        return response(404, {'error': 'User not found in database'})
    
    # Remove sensitive fields
    user.pop('password_hash', None)
    
    # Ensure settings fields exist
    if 'notifications' not in user:
        user['notifications'] = {}
    if 'system' not in user:
        user['system'] = {}
    
    return response(200, {'user': user})


def to_decimal(obj):
    """Recursively convert floats to Decimal for DynamoDB"""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [to_decimal(v) for v in obj]
    return obj


def update_user_profile(user_id: str, body: dict) -> dict:
    """Update user profile"""
    update_expr = 'SET updated_at = :updated'
    expr_values = {':updated': datetime.utcnow().isoformat()}
    expr_names = {}
    
    # Convert floats to decimals for DynamoDB
    body = to_decimal(body)
    
    if 'name' in body:
        update_expr += ', #name = :name'
        expr_values[':name'] = body['name']
        expr_names['#name'] = 'name'
        
    if 'notifications' in body:
        update_expr += ', #notif = :notif'
        expr_values[':notif'] = body['notifications']
        expr_names['#notif'] = 'notifications'
        
    if 'system' in body:
        update_expr += ', #sys = :sys'
        expr_values[':sys'] = body['system']
        expr_names['#sys'] = 'system'
    
    users_table.update_item(
        Key={'user_id': user_id},
        UpdateExpression=update_expr,
        ExpressionAttributeValues=expr_values,
        ExpressionAttributeNames=expr_names if expr_names else None
    )
    
    return response(200, {'message': 'Profile updated'})


# ============= SETTINGS =============

def handle_settings(method: str, body: dict, user_id: str) -> dict:
    """Handle settings requests"""
    if method == 'GET':
        return get_settings(user_id)
    elif method == 'PUT':
        return update_settings(user_id, body)
    
    return response(404, {'error': 'Settings route not found'})


def get_settings(user_id: str) -> dict:
    """Get user settings"""
    result = users_table.get_item(Key={'user_id': user_id})
    user = result.get('Item')
    
    if not user:
        return response(404, {'error': 'User not found'})
    
    # Construct settings object from user profile
    settings = {
        'user_id': user.get('user_id'),
        'email': user.get('email'),
        'name': user.get('name'),
        'role': user.get('role', 'user'),
        'notifications': user.get('notifications', {}),
        'system': user.get('system', {})
    }
    
    return response(200, {'settings': settings})


def update_settings(user_id: str, body: dict) -> dict:
    """Update user settings"""
    update_expr = 'SET updated_at = :updated'
    expr_values = {':updated': datetime.utcnow().isoformat()}
    expr_names = {}
    
    # Update nested maps if provided
    if 'notifications' in body:
        update_expr += ', #notif = :notif'
        expr_values[':notif'] = body['notifications']
        expr_names['#notif'] = 'notifications'
        
    if 'system' in body:
        update_expr += ', #sys = :sys'
        expr_values[':sys'] = body['system']
        expr_names['#sys'] = 'system'
        
    if 'name' in body:
        update_expr += ', #name = :name'
        expr_values[':name'] = body['name']
        expr_names['#name'] = 'name'
        
    # Handle SNS Subscription if notifications enabled
    if 'notifications' in body:
        notif_settings = body['notifications']
        water_alert = notif_settings.get('water_ready_alert') or notif_settings.get('waterReadyAlert')
        if water_alert:
             # Get user email
             user_res = users_table.get_item(Key={'user_id': user_id})
             email = user_res.get('Item', {}).get('email')
             try:
                 if email:
                     # Create independent topic for user
                     topic_arn = ensure_user_topic(user_id, email)
                     
                     if topic_arn:
                         # Store ARN in profile immediately
                         update_expr += ', sns_topic_arn = :arn'
                         expr_values[':arn'] = topic_arn
                         
             except Exception as e:
                 print(f"SNS Subscribe failed: {e}")
    
    try:
        users_table.update_item(
            Key={'user_id': user_id},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
            ExpressionAttributeNames=expr_names if expr_names else None
        )
        
        return response(200, {'message': 'Settings updated'})
    except Exception as e:
        print(f"Error updating settings: {str(e)}")
        return response(500, {'error': 'Failed to update settings'})


# ============= ADMIN =============

def handle_admin(method: str, path: str, params: dict, query: dict, body: dict = None) -> dict:
    """Handle admin requests"""
    
    # Admin User Actions
    if path.startswith('/admin/users'):
        if path == '/admin/users' and method == 'GET':
            return list_all_users()
        
        # User management paths: /admin/users/{userId} or /admin/users/{userId}/role
        parts = path.split('/')
        if len(parts) >= 4:
            target_user_id = parts[3]
            
            if len(parts) == 4 and method == 'DELETE':
                return delete_user_admin(target_user_id)
                
            if len(parts) == 5 and parts[4] == 'role' and method == 'POST':
                # body is passed directly now
                role_data = body if body else {}
                # If body was stringified JSON in some contexts:
                if isinstance(role_data, str):
                    role_data = json.loads(role_data)
                    
                return update_user_role(target_user_id, role_data.get('role'))

    
    if '/stats' in path:
        # Check for userId in query params for filtering
        target_user_id = query.get('userId') if query else None
        return get_system_stats(target_user_id)
    
    elif '/devices' in path:
        return list_all_devices()
    
    return response(404, {'error': 'Admin route not found'})


def get_system_stats(target_user_id: str = None) -> dict:
    """
    Get system-wide statistics.
    If target_user_id is provided, return stats ONLY for that user.
    """
    # Scan all tables fully
    users_res = scan_all_items(users_table)
    devices_res = scan_all_items(devices_table)
    sessions_res = scan_all_items(sessions_table)
    
    # If filtering by user, filter the lists first
    if target_user_id:
        users_res = [u for u in users_res if u.get('user_id') == target_user_id]
        # Identify devices owned by this user
        user_devices = {d.get('device_id') for d in devices_res if d.get('user_id') == target_user_id}
        devices_res = [d for d in devices_res if d.get('device_id') in user_devices]
        # Identify sessions from those devices
        sessions_res = [s for s in sessions_res if s.get('device_id') in user_devices]
    
    # Simple counts
    users_count = len(users_res)
    devices_count = len(devices_res)
    sessions_count = len(sessions_res)
    
    # Online devices count
    online_count = sum(1 for d in devices_res if d.get('status') == 'online')
    
    # Total water saved in completed sessions
    total_water = sum(
        float(s.get('water_saved', 0)) 
        for s in sessions_res 
        if s.get('status') == 'completed'
    )
    
    # Generate Daily Data (All Time)
    daily_data = []
    days_map = {}
    
    # Process all sessions
    for s in sessions_res:
        if not s.get('start_time'): continue
        try:
            # Handle timestamps (Shift UTC to UTC+2 for Israel Time)
            st_str = str(s['start_time']).replace('Z', '')
            st = datetime.fromisoformat(st_str)
            st_israel = st + timedelta(hours=2)
            
            # Group by date YYYY-MM-DD
            day_key = st_israel.strftime('%Y-%m-%d')
            
            if day_key not in days_map:
                days_map[day_key] = {'date': day_key, 'sessions': 0, 'water': Decimal('0')}
            
            days_map[day_key]['sessions'] += 1
            if s.get('status') == 'completed':
                 days_map[day_key]['water'] += Decimal(str(s.get('water_saved', 0)))
                 
        except Exception as e:
            print(f"Error parsing date {s.get('start_time')}: {e}")
            continue

    # Convert map to sorted list
    daily_data = sorted(days_map.values(), key=lambda x: x['date'])
    
    # Convert decimals to float for JSON
    for d in daily_data:
        d['water'] = float(d['water'])

    return response(200, {
        'total_users': users_count,
        'total_devices': devices_count,
        'devices_online': online_count,
        'total_sessions': sessions_count,
        'total_water_saved': total_water,
        'activity_data': daily_data 
    })



def scan_all_items(table, **kwargs):
    """Helper to scan all items with pagination"""
    items = []
    response = table.scan(**kwargs)
    items.extend(response.get('Items', []))
    
    while 'LastEvaluatedKey' in response:
        kwargs['ExclusiveStartKey'] = response['LastEvaluatedKey']
        response = table.scan(**kwargs)
        items.extend(response.get('Items', []))
        
    return items

def list_all_users() -> dict:
    """List all users (admin only)"""
    # Get all users
    users = scan_all_items(users_table)
    
    # Get all devices
    devices = scan_all_items(devices_table, ProjectionExpression='user_id')
    device_counts = {}
    for d in devices:
        uid = d.get('user_id')
        if uid:
            device_counts[uid] = device_counts.get(uid, 0) + 1
        
    # Get all sessions
    sessions = scan_all_items(sessions_table, ProjectionExpression='user_id')
    session_counts = {}
    for s in sessions:
        uid = s.get('user_id')
        if uid:
            session_counts[uid] = session_counts.get(uid, 0) + 1
    
    # Merge counts into user objects
    for user in users:
        user.pop('password_hash', None)
        uid = user.get('user_id')
        user['devices_count'] = device_counts.get(uid, 0)
        user['sessions_count'] = session_counts.get(uid, 0)
    
    return response(200, {'users': users})



def list_all_devices() -> dict:
    """List all devices (admin only)"""
    devices = scan_all_items(devices_table)
    return response(200, {'devices': devices})

def delete_user_admin(target_user_id: str) -> dict:
    """Admin: Delete a user from DB and Cognito"""
    print(f"Admin deleting user: {target_user_id}")
    
    try:
        # 1. Delete from Cognito
        try:
            cognito_client.admin_delete_user(
                UserPoolId=USER_POOL_ID,
                Username=target_user_id
            )
            print("Deleted from Cognito")
        except cognito_client.exceptions.UserNotFoundException:
            print("User not found in Cognito, proceeding to DB delete")
        except Exception as e:
            print(f"Error deleting from Cognito: {str(e)}")
            # Continue to delete from DB anyway
            
        # 2. Find and Delete User's Devices and Sessions
        try:
            # Query devices by user_index
            dev_response = devices_table.query(
                IndexName='user-index',
                KeyConditionExpression=Key('user_id').eq(target_user_id)
            )
            devices = dev_response.get('Items', [])
            
            for device in devices:
                dev_id = device['device_id']
                
                # Delete sessions for this device
                try:
                    sess_response = sessions_table.query(
                        IndexName='device-index',
                        KeyConditionExpression=Key('device_id').eq(dev_id)
                    )
                    for session in sess_response.get('Items', []):
                        sessions_table.delete_item(Key={'session_id': session['session_id']})
                        print(f"Deleted session {session['session_id']}")
                except Exception as s_err:
                    print(f"Error cleaning sessions for device {dev_id}: {s_err}")
                
                # Delete the device itself
                devices_table.delete_item(Key={'device_id': dev_id})
                print(f"Deleted device {dev_id}")
                
        except Exception as d_err:
            print(f"Error performing cascading delete: {d_err}")

        # 3. Delete from Users Table
        users_table.delete_item(Key={'user_id': target_user_id})
        
        return response(200, {'message': f'User {target_user_id} and all associated data deleted successfully'})
        
    except Exception as e:
        print(f"Error deleting user: {str(e)}")
        return response(500, {'error': str(e)})


def update_user_role(target_user_id: str, new_role: str) -> dict:
    """Admin: Promote/Demote user"""
    print(f"Admin updating role for {target_user_id} to {new_role}")
    
    if new_role not in ['admin', 'user']:
        return response(400, {'error': 'Invalid role. Must be admin or user'})

    try:
        # 1. Update Cognito Attribute
        cognito_client.admin_update_user_attributes(
            UserPoolId=USER_POOL_ID,
            Username=target_user_id,
            UserAttributes=[
                {'Name': 'custom:role', 'Value': new_role}
            ]
        )
        
        # 2. Update Cognito Group (Add/Remove from 'admins')
        try:
            if new_role == 'admin':
                cognito_client.admin_add_user_to_group(
                    UserPoolId=USER_POOL_ID,
                    Username=target_user_id,
                    GroupName='admins'
                )
            else:
                cognito_client.admin_remove_user_from_group(
                    UserPoolId=USER_POOL_ID,
                    Username=target_user_id,
                    GroupName='admins'
                )
        except Exception as e:
            print(f"Group update warning: {str(e)}")

        # 3. Update DynamoDB
        users_table.update_item(
            Key={'user_id': target_user_id},
            UpdateExpression='SET #r = :role, updated_at = :ts',
            ExpressionAttributeNames={'#r': 'role'},
            ExpressionAttributeValues={
                ':role': new_role,
                ':ts': datetime.utcnow().isoformat()
            }
        )
        
        return response(200, {'message': f'User role updated to {new_role}'})
        
    except Exception as e:
        print(f"Error updating role: {str(e)}")
        return response(500, {'error': str(e)})


def delete_session(session_id: str, user_id: str) -> dict:
    """User: Delete a specific session history item"""
    print(f"Deleting session {session_id} for user {user_id}")
    
    try:
        # Get session to verify ownership
        resp = sessions_table.get_item(Key={'session_id': session_id})
        session = resp.get('Item')
        
        if not session:
            return response(404, {'error': 'Session not found'})
            
        # Verify ownership via device ownership
        device_id = session.get('device_id')
        user_id_match = False
        
        if not device_id:
             # Orphaned session? Allow delete if we can't verify owner?
             # Or fail. For safety, fail or assume owned by admin?
             # Let's verify if user_id matches the one on session (if we stored it)
             # Looking at start_session, we DO store 'user_id' in session!
             # So we can verify against session['user_id'] directly!
             stored_user_id = session.get('user_id')
             if stored_user_id and stored_user_id == user_id:
                 user_id_match = True
             else:
                 return response(403, {'error': 'Cannot verify ownership (no device_id)'})
        else:
            # Check if device belongs to user
            dev_resp = devices_table.get_item(Key={'device_id': device_id})
            device = dev_resp.get('Item')
            
            if device and device.get('user_id') == user_id:
                user_id_match = True
                
        # Allow admins to delete as well? For now, stick to owner.
        if not user_id_match:
            return response(403, {'error': 'Not authorized to delete this session'})

        # Capture stats before delete
        water_saved = session.get('water_saved', Decimal('0'))
        
        # Delete Session
        sessions_table.delete_item(Key={'session_id': session_id})
        
        # Update Device Stats (Decrement)
        if device_id:
            try:
                devices_table.update_item(
                    Key={'device_id': device_id},
                    UpdateExpression='ADD total_water_saved :w, total_sessions :i',
                    ExpressionAttributeValues={
                        ':w': -water_saved,
                        ':i': -1
                    }
                )
            except Exception as e:
                print(f"Failed to decrement device stats: {e}")
        
        return response(200, {'message': 'Session deleted and stats updated'})

    except Exception as e:
        print(f"Error deleting session: {str(e)}")
        return response(500, {'error': str(e)})
