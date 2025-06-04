#!/bin/bash

# Colors for better output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}TradeStats - Supabase RLS Policy Fix Script${NC}"
echo "--------------------------------------"
echo -e "This script will fix the Row Level Security (RLS) policies in your Supabase project."
echo -e "It will ensure that authenticated users can properly interact with the database tables."
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo -e "${RED}Error: psql is not installed.${NC}"
    echo "Please install PostgreSQL client tools to run this script."
    exit 1
fi

# Prompt for Supabase URL
echo -e "${YELLOW}Please enter your Supabase URL:${NC}"
echo "Example: https://hfxvnajwwhlqnfjfdqwi.supabase.co"
read SUPABASE_URL

# Extract the host from the URL
if [[ $SUPABASE_URL == https://* ]]; then
    HOST=$(echo $SUPABASE_URL | sed 's|https://||' | sed 's|\.supabase\.co.*||')
else
    HOST=$SUPABASE_URL
fi

# Prompt for Supabase service role key
echo -e "${YELLOW}Please enter your Supabase service_role key:${NC}"
echo "You can find this in your Supabase dashboard under Project Settings > API"
read -s SUPABASE_SERVICE_ROLE_KEY

echo ""
echo "Preparing to apply RLS policy fixes..."

# Get the directory where the script is located
SCRIPT_DIR=$(dirname "$0")
SQL_FILE="${SCRIPT_DIR}/migrations/20240529_fix_rls_policies.sql"
AUTH_FIX_FILE="${SCRIPT_DIR}/migrations/20240529_fix_rls_auth_issue.sql"
PERMISSIVE_RESET_FILE="${SCRIPT_DIR}/migrations/20240529_rls_permissions_reset.sql"

# Check if SQL files exist
if [ ! -f "$SQL_FILE" ]; then
    echo -e "${RED}Error: SQL file not found: ${SQL_FILE}${NC}"
    exit 1
fi

if [ ! -f "$AUTH_FIX_FILE" ]; then
    echo -e "${RED}Error: Auth fix SQL file not found: ${AUTH_FIX_FILE}${NC}"
    exit 1
fi

if [ ! -f "$PERMISSIVE_RESET_FILE" ]; then
    echo -e "${RED}Error: Permissive reset SQL file not found: ${PERMISSIVE_RESET_FILE}${NC}"
    exit 1
fi

# Ask user which approach to use
echo -e "${YELLOW}Choose a fix approach:${NC}"
echo "1) Standard fix (recommended for regular use)"
echo "2) Advanced fix with specific auth permissions"
echo "3) Permissive reset (use if other options fail)"
read -p "Enter option [1-3]: " FIX_OPTION

# Construct the database connection string
DB_URL="postgres://postgres:${SUPABASE_SERVICE_ROLE_KEY}@db.${HOST}.supabase.co:5432/postgres"

if [ "$FIX_OPTION" == "1" ]; then
    echo "Applying general RLS policy fixes..."
    PGPASSWORD=$SUPABASE_SERVICE_ROLE_KEY psql -h db.${HOST}.supabase.co -U postgres -d postgres -f "$SQL_FILE"
    
    if [ $? -ne 0 ]; then
        echo -e "${RED}Failed to apply general RLS policy fixes.${NC}"
        echo "Please try running the SQL manually through the Supabase dashboard SQL editor."
    else
        echo -e "${GREEN}Successfully applied general RLS policy fixes.${NC}"
    fi
elif [ "$FIX_OPTION" == "2" ]; then
    echo "Applying general RLS policy fixes..."
    PGPASSWORD=$SUPABASE_SERVICE_ROLE_KEY psql -h db.${HOST}.supabase.co -U postgres -d postgres -f "$SQL_FILE"
    
    echo "Applying specific auth permission fixes..."
    PGPASSWORD=$SUPABASE_SERVICE_ROLE_KEY psql -h db.${HOST}.supabase.co -U postgres -d postgres -f "$AUTH_FIX_FILE"
elif [ "$FIX_OPTION" == "3" ]; then
    echo -e "${YELLOW}WARNING: You're about to apply a very permissive security configuration.${NC}"
    echo "This should only be used during development/testing."
    read -p "Are you sure you want to continue? [y/N] " CONFIRM
    
    if [[ $CONFIRM == "y" || $CONFIRM == "Y" ]]; then
        echo "Applying permissive RLS reset..."
        PGPASSWORD=$SUPABASE_SERVICE_ROLE_KEY psql -h db.${HOST}.supabase.co -U postgres -d postgres -f "$PERMISSIVE_RESET_FILE"
    else
        echo "Operation cancelled."
        exit 0
    fi
else
    echo -e "${RED}Invalid option selected.${NC}"
    exit 1
fi

if [ $? -eq 0 ]; then
    echo -e "${GREEN}Success! RLS policies have been updated.${NC}"
    echo "You should now be able to use the onboarding form without 401 errors."
    echo ""
    echo "If you still encounter issues, please check:"
    echo "1. That you've used the correct Supabase URL and service role key"
    echo "2. That you're properly logged in to the application"
    echo "3. The browser console for any additional error messages"
else
    echo -e "${RED}Failed to apply the SQL changes.${NC}"
    echo "Please try running the SQL manually through the Supabase dashboard SQL editor."
    echo "The SQL files are located at:"
    echo "- ${SQL_FILE}"
    echo "- ${AUTH_FIX_FILE}"
    echo "- ${PERMISSIVE_RESET_FILE}"
fi 