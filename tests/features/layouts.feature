@administration @layouts
Feature: Layouts and blocks
  As a tester of a site
  I want to use the layout editor: add, configure, move, disable and remove blocks, set visibility conditions, save or cancel
  So that the way pages are built from blocks is covered

  # The editor keeps changes aside until "Save layout". Scenarios that only look
  # cancel their changes; scenarios that save put the layout back before they end.

  Background:
    Given I am logged in as "admin"

  @critical
  Scenario: The list of layouts describes the layouts of the site
    Given I am on the "layouts" administration page
    Then the listing should list "Default Layout"
    And the listing should list "Home page"
    And the "Default Layout" layout should use the "Moscone Flipped" template
    And the "Home page" layout should use the "Boxton" template
    And the "Home page" layout should apply to the path "home"
    And the "Home page" layout should not apply to the path "admin/dashboard"
    And the "Dashboard" layout should apply to the path "admin/dashboard"
    And the "Dashboard" layout should have a condition containing "Access Dashboard"
    And the "Home page" layout should not have a condition containing "Access Dashboard"

  @critical
  Scenario: The layout editor shows the regions and blocks of a layout
    Given the "Default Layout" layout has no unsaved changes
    And I am editing the "Default Layout" layout
    Then the layout should have the "Header" region
    And the layout should have the "Sidebar" region
    And the layout should have the "Footer" region
    And the layout should not have the "Drawer" region
    And the "Header" region should have the "Header block" block
    And the "Header" region should have the "Primary navigation" block
    And the "Header" region should have the "Search form" block
    And the "Header" region should have 3 blocks
    And the "Content" region should have the "Main page content" block
    And the "Sidebar" region should have 0 blocks
    And the "Sidebar" region should not have the "Syndicate" block
    And the "Header block" block should come before the "Primary navigation" block in the "Header" region
    And the layout should not have unsaved changes

  Scenario: The block list of a region is searched
    Given the "Default Layout" layout has no unsaved changes
    And I am editing the "Default Layout" layout
    When I open the block list of the "Sidebar" region
    Then I should see the dialog "Add block"
    And the block list should offer "Syndicate"
    And the block list should offer "User login"
    When I search the block list for "Syndic"
    Then the block list should offer "Syndicate"
    And the block list should not offer "User login"
    When I close the dialog
    Then I should not see the dialog "Add block"
    And the layout should not have unsaved changes

  Scenario: A block is added, disabled, enabled and removed, and the changes are cancelled
    Given the "Default Layout" layout has no unsaved changes
    And I am editing the "Default Layout" layout
    When I add the "Syndicate" block to the "Sidebar" region
    Then the "Sidebar" region should have the "Syndicate" block
    And the "Sidebar" region should have 1 block
    And the layout should have unsaved changes
    And the warning message should contain "This form has unsaved changes."
    When I disable the "Syndicate" block of the "Sidebar" region
    Then the "Syndicate" block of the "Sidebar" region should be disabled
    When I enable the "Syndicate" block of the "Sidebar" region
    Then the "Syndicate" block of the "Sidebar" region should be enabled
    When I remove the "Syndicate" block from the "Sidebar" region
    Then the "Sidebar" region should not have the "Syndicate" block
    When I cancel the layout changes
    Then the status message should be "Layout changes discarded."
    When I am editing the "Default Layout" layout
    Then the layout should not have unsaved changes
    And the "Sidebar" region should have 0 blocks

  Scenario: A block is moved between regions and inside a region with the keyboard
    Given the "Default Layout" layout has no unsaved changes
    And I am editing the "Default Layout" layout
    When I add the "Syndicate" block to the "Sidebar" region
    And I add the "User login" block to the "Sidebar" region
    Then the "Syndicate" block should come before the "User login" block in the "Sidebar" region
    When I move the "User login" block of the "Sidebar" region up
    Then the "User login" block should come before the "Syndicate" block in the "Sidebar" region
    When I move the "User login" block of the "Sidebar" region down
    Then the "Syndicate" block should come before the "User login" block in the "Sidebar" region
    When I move the "Syndicate" block of the "Sidebar" region to the "Footer" region
    Then the "Footer" region should have the "Syndicate" block
    And the "Sidebar" region should not have the "Syndicate" block
    And the "Sidebar" region should have 1 block
    When I move the "Syndicate" block of the "Footer" region to the "Top" region
    Then the "Top" region should have the "Syndicate" block
    When I cancel the layout changes
    Then the status message should be "Layout changes discarded."

  Scenario: A block is configured in its dialog
    Given the "Default Layout" layout has no unsaved changes
    And I am editing the "Default Layout" layout
    When I add the "Syndicate" block to the "Footer" region with the title "Feeds from the suite"
    And I configure the "Syndicate" block of the "Footer" region
    Then I should see the dialog "Configure block"
    And the "Custom title" field should have the value "Feeds from the suite"
    And the "Block title type" field should have the value "Custom"
    When I enter "Renamed by the suite" in the "Custom title" field
    And I press "Update block" in the dialog
    And I configure the "Syndicate" block of the "Footer" region
    Then the "Custom title" field should have the value "Renamed by the suite"
    When I close the dialog
    Then I should not see the dialog "Configure block"
    When I cancel the layout changes
    Then the status message should be "Layout changes discarded."

  Scenario: A saved block shows on the site and is removed again
    Given the "Default Layout" layout has no unsaved changes
    And I am editing the "Default Layout" layout
    When I add the "User login" block to the "Sidebar" region with the title "Members of the suite"
    And I save the layout changes
    Then the status message should contain "Layout content saved."
    # Pages for visitors are cached by the site and, for five minutes, by the browser:
    # a tester flushes the caches and reloads the page to see the change at once.
    When I flush all caches from the administration bar
    And I log out of the site
    And I go to "/visit-the-apiary"
    And I reload the page
    Then I should see the block titled "Members of the suite"
    Given I am logged in as "admin"
    And I am editing the "Default Layout" layout
    When I remove the "User login" block from the "Sidebar" region
    And I save the layout changes
    And I flush all caches from the administration bar
    And I log out of the site
    And I go to "/visit-the-apiary"
    And I reload the page
    Then I should not see the block titled "Members of the suite"

  Scenario: A visibility condition limits a block to a role
    Given the "Default Layout" layout has no unsaved changes
    And I am editing the "Default Layout" layout
    When I open the block list of the "Sidebar" region
    And I choose "Syndicate" from the block list
    And I pick "Custom" in the "Block title type" field
    And I enter "Feeds for editors from the suite" in the "Custom title" field
    And I start the visibility condition "User account: Role" in the dialog
    Then I should see the dialog "Add condition"
    When I check "Editor"
    And I press "Add condition" in the dialog
    Then the dialog should list a visibility condition containing "Editor"
    And the dialog should not list a visibility condition containing "Administrator"
    # The block joined the layout when its condition was added: the dialog now updates it.
    When I press "Update block" in the dialog
    Then the "Sidebar" region should have the "Syndicate" block
    And the "Syndicate" block of the "Sidebar" region should have a condition containing "User has the role Editor"
    And the "Syndicate" block of the "Sidebar" region should not have a condition containing "Administrator"
    When I save the layout changes
    And I log in as "editor"
    And I go to "/visit-the-apiary"
    And I reload the page
    Then I should see the block titled "Feeds for editors from the suite"
    When I log in as "member"
    And I go to "/visit-the-apiary"
    And I reload the page
    Then I should not see the block titled "Feeds for editors from the suite"
    Given I am logged in as "admin"
    And I am editing the "Default Layout" layout
    When I remove the "Syndicate" block from the "Sidebar" region
    And I save the layout changes
    And I am editing the "Default Layout" layout
    Then the "Sidebar" region should have 0 blocks

  Scenario: The editor role has no layout editor
    Given I am logged in as "editor"
    Then I should not have access to "admin/structure/layouts"
    And I should not have access to "admin/structure/layouts/manage/default"
